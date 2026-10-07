import os
import sys
import time
import secrets
import asyncio
import logging
import sqlite3
import shutil
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager

import aiohttp
import aiofiles
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lx-music-share")

# 路径常量
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
MEDIA_DIR = DATA_DIR / "media"
DB_PATH = DATA_DIR / "shares.db"
TEMPLATES_DIR = BASE_DIR / "templates"

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# 基础环境变量配置
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
SHARE_TOKEN = os.getenv("SHARE_TOKEN", "")  # 若设置则必须验证 token
DEFAULT_TTL_DAYS = int(os.getenv("DEFAULT_TTL_DAYS", "7"))
MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024  # 100MB

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def init_db():
    """初始化 SQLite 数据库"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS shares (
            code TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            singer TEXT NOT NULL,
            album TEXT,
            duration INTEGER DEFAULT 0,
            source TEXT,
            songmid TEXT,
            raw_audio_url TEXT,
            raw_pic_url TEXT,
            has_audio BOOLEAN DEFAULT 0,
            has_cover BOOLEAN DEFAULT 0,
            has_lrc BOOLEAN DEFAULT 0,
            audio_ext TEXT DEFAULT 'mp3',
            created_at INTEGER NOT NULL,
            expire_at INTEGER NOT NULL,
            view_count INTEGER DEFAULT 0
        )
    """)
    # 自动增补字段（兼容已有数据库）
    try:
        cur.execute("ALTER TABLE shares ADD COLUMN raw_audio_url TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        cur.execute("ALTER TABLE shares ADD COLUMN raw_pic_url TEXT")
    except sqlite3.OperationalError:
        pass
    cur.execute("CREATE INDEX IF NOT EXISTS idx_expire_at ON shares(expire_at)")

    # 评价留言表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            nickname TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            user_agent TEXT
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_comments_code ON comments(code)")
    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def generate_short_code(length: int = 6) -> str:
    """生成 6 位安全短码"""
    chars = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(secrets.choice(chars) for _ in range(length))


async def download_file(url: str, dest_path: Path, max_bytes: int = MAX_AUDIO_SIZE_BYTES) -> bool:
    """安全流式下载外部文件，带多环境防盗链伪装与大小限制"""
    user_agents = [
        "okhttp/3.12.12",
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]
    for ua in user_agents:
        headers = {
            "User-Agent": ua,
            "Accept": "*/*",
            "Range": "bytes=0-",
        }
        try:
            timeout = aiohttp.ClientTimeout(total=45)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=headers) as resp:
                    if resp.status not in (200, 206):
                        logger.warning(f"下载尝试失败 [UA={ua[:15]}] {url}，状态码: {resp.status}")
                        continue
                    downloaded = 0
                    async with aiofiles.open(dest_path, "wb") as f:
                        async for chunk in resp.content.iter_chunked(64 * 1024):
                            downloaded += len(chunk)
                            if downloaded > max_bytes:
                                logger.warning(f"文件超过大小限制 {max_bytes} 字节，下载终止")
                                return False
                            await f.write(chunk)
                    return True
        except Exception as e:
            logger.error(f"下载异常 {url}: {e}")
            if dest_path.exists():
                dest_path.unlink(missing_ok=True)
    return False


async def process_media_persistence(code: str, audio_url: Optional[str], pic_url: Optional[str], lrc_text: Optional[str]):
    """后台任务：流式持久化音频、封面和歌词"""
    folder = MEDIA_DIR / code
    folder.mkdir(parents=True, exist_ok=True)

    has_audio = False
    has_cover = False
    has_lrc = False
    audio_ext = "mp3"

    # 1. 歌词文本写入
    if lrc_text and lrc_text.strip():
        lrc_path = folder / "lyric.lrc"
        try:
            async with aiofiles.open(lrc_path, "w", encoding="utf-8") as f:
                await f.write(lrc_text)
            has_lrc = True
        except Exception as e:
            logger.error(f"写入歌词失败 {code}: {e}")

    # 2. 封面下载
    if pic_url and pic_url.startswith("http"):
        cover_path = folder / "cover.jpg"
        has_cover = await download_file(pic_url, cover_path, max_bytes=10 * 1024 * 1024)

    # 3. 音频流下载
    if audio_url and audio_url.startswith("http"):
        audio_path = folder / "audio.mp3"
        has_audio = await download_file(audio_url, audio_path, max_bytes=MAX_AUDIO_SIZE_BYTES)

    # 更新数据库状态
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE shares SET has_audio = ?, has_cover = ?, has_lrc = ?, audio_ext = ? WHERE code = ?",
        (1 if has_audio else 0, 1 if has_cover else 0, 1 if has_lrc else 0, audio_ext, code),
    )
    conn.commit()
    conn.close()
    logger.info(f"分享资源处理完毕 [{code}]: 音频={has_audio}, 封面={has_cover}, 歌词={has_lrc}")


async def cleanup_expired_task():
    """定时任务：每小时扫描并物理删除过期文件与数据"""
    while True:
        try:
            await asyncio.sleep(3600)
            now = int(time.time())
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT code FROM shares WHERE expire_at > 0 AND expire_at < ?", (now,))
            rows = cur.fetchall()
            if rows:
                expired_codes = [r["code"] for r in rows]
                logger.info(f"开始清理过期分享，共 {len(expired_codes)} 条: {expired_codes}")
                for code in expired_codes:
                    target_dir = MEDIA_DIR / code
                    if target_dir.exists():
                        shutil.rmtree(target_dir, ignore_errors=True)
                placeholders = ",".join(["?"] * len(expired_codes))
                cur.execute(f"DELETE FROM comments WHERE code IN ({placeholders})", expired_codes)
                cur.execute(f"DELETE FROM shares WHERE expire_at > 0 AND expire_at < ?", (now,))
                conn.commit()
                logger.info("过期分享文件、留言及数据库记录清理完成")
            conn.close()
        except Exception as e:
            logger.error(f"清理任务异常: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    cleanup_handle = asyncio.create_task(cleanup_expired_task())
    logger.info("服务初始化完成，TTL 清理后台守护协程已就绪")
    yield
    cleanup_handle.cancel()


app = FastAPI(title="LX Music Share Service", lifespan=lifespan)


class ShareRequest(BaseModel):
    token: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    singer: str = Field(..., max_length=200)
    album: Optional[str] = ""
    duration: Optional[int] = 0
    source: Optional[str] = ""
    songmid: Optional[str] = ""
    audioUrl: Optional[str] = None
    picUrl: Optional[str] = None
    lrc: Optional[str] = None
    ttl_days: Optional[int] = Field(default=DEFAULT_TTL_DAYS, ge=0, le=365)


class CommentRequest(BaseModel):
    nickname: Optional[str] = Field(default="听友", max_length=30)
    content: str = Field(..., min_length=1, max_length=300)


@app.post("/api/share")
async def create_share(req: ShareRequest, background_tasks: BackgroundTasks, x_share_token: Optional[str] = Header(None)):
    """接收手机端分享请求并排队持久化"""
    provided_token = req.token or x_share_token or ""
    if SHARE_TOKEN and provided_token != SHARE_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 鉴权失败，未授权操作")

    now = int(time.time())
    ttl_days = req.ttl_days if req.ttl_days is not None else DEFAULT_TTL_DAYS
    expire_at = (now + ttl_days * 86400) if ttl_days > 0 else 0

    # 生成不重复短码
    conn = get_db()
    cur = conn.cursor()
    code = ""
    for _ in range(10):
        test_code = generate_short_code(6)
        cur.execute("SELECT 1 FROM shares WHERE code = ?", (test_code,))
        if not cur.fetchone():
            code = test_code
            break
    if not code:
        conn.close()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="短码生成冲突，请稍后重试")

    cur.execute(
        """
        INSERT INTO shares (code, title, singer, album, duration, source, songmid, raw_audio_url, raw_pic_url, created_at, expire_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (code, req.title, req.singer, req.album or "", req.duration or 0, req.source or "", req.songmid or "", req.audioUrl or "", req.picUrl or "", now, expire_at),
    )
    conn.commit()
    conn.close()

    # 排队异步后台下载
    background_tasks.add_task(process_media_persistence, code, req.audioUrl, req.picUrl, req.lrc)

    share_url = f"{BASE_URL}/s/{code}"
    return {
        "code": 0,
        "msg": "success",
        "data": {
            "shareCode": code,
            "shareUrl": share_url,
            "title": req.title,
            "singer": req.singer,
            "expireAt": expire_at,
            "ttlDays": ttl_days,
        },
    }


@app.get("/s/{code}", response_class=HTMLResponse)
async def share_page(code: str, request: Request):
    """分享单页，自适应手机浏览器与微信内置浏览器"""
    now = int(time.time())
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shares WHERE code = ?", (code,))
    row = cur.fetchone()

    if not row:
        conn.close()
        return templates.TemplateResponse(
            request=request,
            name="player.html",
            context={"status": "not_found", "message": "该分享链接不存在或已被删除"},
            status_code=404,
        )

    # 检查是否过期
    if row["expire_at"] > 0 and now > row["expire_at"]:
        conn.close()
        return templates.TemplateResponse(
            request=request,
            name="player.html",
            context={"status": "expired", "message": "该音乐分享已达到有效期限，已自动清理失效"},
            status_code=410,
        )

    # 增加播放访问统计
    cur.execute("UPDATE shares SET view_count = view_count + 1 WHERE code = ?", (code,))

    # 获取本歌曲已有的听友留言
    cur.execute("SELECT id, nickname, content, created_at FROM comments WHERE code = ? ORDER BY id ASC LIMIT 100", (code,))
    comment_rows = cur.fetchall()
    comments = [
        {
            "id": c["id"],
            "nickname": c["nickname"],
            "content": c["content"],
            "created_at": c["created_at"],
        }
        for c in comment_rows
    ]
    conn.commit()
    conn.close()

    expire_str = "永久有效"
    if row["expire_at"] > 0:
        remaining_hours = max(1, int((row["expire_at"] - now) / 3600))
        if remaining_hours > 24:
            expire_str = f"剩余有效约 {int(remaining_hours / 24)} 天"
        else:
            expire_str = f"剩余有效约 {remaining_hours} 小时"

    lrc_text = ""
    if row["has_lrc"]:
        lrc_file = MEDIA_DIR / code / "lyric.lrc"
        if lrc_file.exists():
            try:
                lrc_text = lrc_file.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"读取本地歌词失败: {e}")

    return templates.TemplateResponse(
        request=request,
        name="player.html",
        context={
            "status": "valid",
            "code": code,
            "title": row["title"],
            "singer": row["singer"],
            "album": row["album"] or "",
            "duration": row["duration"] or 0,
            "expire_str": expire_str,
            "audio_url": f"/media/{code}/audio.mp3" if row["has_audio"] else (row["raw_audio_url"] or f"/media/{code}/audio.mp3"),
            "cover_url": f"/media/{code}/cover.jpg" if row["has_cover"] else (row["raw_pic_url"] or ""),
            "lrc_url": f"/media/{code}/lyric.lrc" if row["has_lrc"] else "",
            "lrc_text": lrc_text,
            "comments": comments,
        },
    )


@app.get("/api/comments/{code}")
async def get_comments(code: str):
    """获取指定分享单页的评价留言"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, nickname, content, created_at FROM comments WHERE code = ? ORDER BY id ASC LIMIT 100", (code,))
    rows = cur.fetchall()
    conn.close()
    return {
        "code": 0,
        "data": [
            {
                "id": r["id"],
                "nickname": r["nickname"],
                "content": r["content"],
                "created_at": r["created_at"],
            }
            for r in rows
        ],
    }


@app.post("/api/comments/{code}")
async def add_comment(code: str, req: CommentRequest, request: Request):
    """发表听友评价/留言"""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="评价内容不能为空")
    if len(content) > 300:
        raise HTTPException(status_code=400, detail="评价内容不能超过300字")
    nickname = (req.nickname or "听友").strip()[:30] or "听友"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT expire_at FROM shares WHERE code = ?", (code,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="该分享不存在")
    now = int(time.time())
    if row["expire_at"] > 0 and now > row["expire_at"]:
        conn.close()
        raise HTTPException(status_code=410, detail="该分享已过期失效")

    ua = request.headers.get("user-agent", "")[:200]
    cur.execute(
        "INSERT INTO comments (code, nickname, content, created_at, user_agent) VALUES (?, ?, ?, ?, ?)",
        (code, nickname, content, now, ua),
    )
    conn.commit()
    comment_id = cur.lastrowid
    conn.close()

    return {
        "code": 0,
        "msg": "success",
        "data": {
            "id": comment_id,
            "nickname": nickname,
            "content": content,
            "created_at": now,
        },
    }


@app.get("/media/{code}/audio")
@app.get("/media/{code}/audio.mp3")
async def get_media_audio(code: str):
    """音频分发保底接口（本地已转存则直接 206 分片直出，未完成则重定向至原始直链）"""
    audio_path = MEDIA_DIR / code / "audio.mp3"
    if audio_path.exists():
        return FileResponse(
            str(audio_path),
            media_type="audio/mpeg",
            filename=f"{code}.mp3",
            headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"},
        )
    # 本地文件不存在时，检查数据库并重定向至原始直链
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT raw_audio_url FROM shares WHERE code = ?", (code,))
    r = cur.fetchone()
    conn.close()
    if r and r["raw_audio_url"]:
        from starlette.responses import RedirectResponse
        return RedirectResponse(url=r["raw_audio_url"], status_code=302)
    raise HTTPException(status_code=404, detail="音频仍在缓存或不存在")


@app.get("/media/{code}/cover")
@app.get("/media/{code}/cover.jpg")
async def get_media_cover(code: str):
    """封面图片接口（本地不存在时重定向至原始图片地址）"""
    cover_path = MEDIA_DIR / code / "cover.jpg"
    if cover_path.exists():
        return FileResponse(str(cover_path), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=604800"})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT raw_pic_url FROM shares WHERE code = ?", (code,))
    r = cur.fetchone()
    conn.close()
    if r and r["raw_pic_url"]:
        from starlette.responses import RedirectResponse
        return RedirectResponse(url=r["raw_pic_url"], status_code=302)
    raise HTTPException(status_code=404, detail="封面图不存在")


@app.get("/media/{code}/lrc")
@app.get("/media/{code}/lyric.lrc")
async def get_media_lrc(code: str):
    """LRC 歌词接口"""
    lrc_path = MEDIA_DIR / code / "lyric.lrc"
    if not lrc_path.exists():
        raise HTTPException(status_code=404, detail="歌词不存在")
    return FileResponse(
        str(lrc_path),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "public, max-age=604800"},
    )


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "time": int(time.time())}
