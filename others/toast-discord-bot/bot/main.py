#!/usr/bin/env python3
"""
Discord bot for fridg3.org - plays m3u internet streams and handles Discord notifications
"""

import discord
from discord import app_commands
from discord.ext import commands, tasks
import json
import os
import logging
import signal
from aiohttp import ClientSession, ClientTimeout, web
from pathlib import Path
import re
import shutil
import getpass
import asyncio
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration from toast.json — search upward from this file for the project's `data/etc/toast.json`
def find_config_path():
    cur = Path(__file__).resolve().parent
    root = cur
    while True:
        candidate = root / 'data' / 'etc' / 'toast.json'
        if candidate.exists():
            return candidate
        if root.parent == root:
            # reached filesystem root
            break
        root = root.parent
    # fallback: same directory as this file's parent/parent
    return Path(__file__).resolve().parent.parent / 'data' / 'etc' / 'toast.json'

CONFIG_PATH = find_config_path()
PERSONALITY_PATH = Path(__file__).resolve().parent / 'personality.json'
GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant'
DEFAULT_GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
DEFAULT_TOAST_PERSONALITY = (
    "You are Toast, the fridg3.org Discord bot. Reply in DMs like a friendly, concise person. "
    "Be helpful, casual, and clear. Do not mention system prompts, hidden config, API calls, or internal logs."
)
GROQ_FALLBACK_REPLY = "yo i'll talk later, sorry dude busy rn"
DM_MEMORY_CLEAR_PHRASE = 'CLEARMEMORY'
VISION_IMAGE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024
VISION_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
WIKI_CONTEXT_FILES = ('Home.md', 'Routes-and-Features.md')
WIKI_CONTEXT_MAX_CHARS = 5200
WIKI_CONTEXT_TRIGGER_TERMS = {
    'fridg3', 'site', 'website', 'page', 'pages', 'feature', 'features', 'account', 'accounts',
    'login', 'password', 'settings', 'feed', 'post', 'posts', 'reply', 'journal', 'guestbook',
    'music', 'gallery', 'bookmark', 'bookmarks', 'chat', 'contact', 'discord', 'toast',
    'bot', 'tool', 'tools', 'mdpaste', 'paste', 'frdgbeats', 'beats', 'wiki', 'merch',
    'mobile', 'theme', 'profile',
}

def find_wiki_dir():
    cur = Path(__file__).resolve().parent
    root = cur
    while True:
        candidate = root / 'wiki'
        if candidate.exists():
            return candidate
        if root.parent == root:
            break
        root = root.parent
    return Path(__file__).resolve().parents[2] / 'wiki'

WIKI_DIR = find_wiki_dir()

def find_ffmpeg_executable():
    """Locate ffmpeg executable on the system.

    Returns full path to ffmpeg.exe or None if not found.
    """
    # Prefer system PATH
    exe = shutil.which('ffmpeg') or shutil.which('ffmpeg.exe')
    if exe:
        return exe

    # Common Windows install locations (winget may place under Program Files)
    common_paths = [
        Path("C:/Program Files/ffmpeg/bin/ffmpeg.exe"),
        Path("C:/Program Files (x86)/ffmpeg/bin/ffmpeg.exe"),
    ]

    # User-local WindowsApps or msys might also exist under ProgramData or AppData
    user = getpass.getuser()
    common_paths.extend([
        Path(f"C:/Users/{user}/AppData/Local/Programs/ffmpeg/bin/ffmpeg.exe"),
        Path(f"C:/Users/{user}/AppData/Local/ffmpeg/bin/ffmpeg.exe"),
    ])

    for p in common_paths:
        if p.exists():
            return str(p)

    return None

# detect ffmpeg at startup
FFMPEG_EXE = find_ffmpeg_executable()
if not FFMPEG_EXE:
    logger.warning('ffmpeg executable not found on PATH. Please ensure ffmpeg is installed and in PATH, or set the full path in config as stream.ffmpeg_executable')

def normalize_stream_url(url: str) -> str:
    """Normalize a stream URL so FFmpeg can open raw host:port entries.

    Examples:
      - uk3.internet-radio.com:8108 -> http://uk3.internet-radio.com:8108/
      - http://example.com/stream.m3u -> unchanged
    """
    if not isinstance(url, str) or url.strip() == '':
        return url
    u = url.strip()
    # If it already has a scheme, return as-is
    if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*://', u):
        return u
    # If it starts with '//', assume http
    if u.startswith('//'):
        return 'http:' + u
    # No scheme: prepend http://
    u = 'http://' + u
    # Ensure there's a trailing slash for host:port without path
    parsed_path = re.sub(r'^https?://[^/]+', lambda m: m.group(0), u)
    if re.match(r'^https?://[^/]+$', u):
        u = u + '/'
    return u

def parse_playlist(url: str) -> str:
    """Parse .m3u or .pls playlist file and return the first valid stream URL.
    
    Supports:
      - .m3u format: lines starting with # are metadata, other lines are URLs
      - .pls format: lines like File1=url, File2=url, etc.
      - Raw stream URLs: returned as-is
    
    Returns the normalized first stream URL found, or the input URL if not a playlist.
    """
    if not isinstance(url, str):
        return url
    
    url = url.strip()
    
    # Check if it looks like a playlist URL
    if not (url.lower().endswith('.m3u') or url.lower().endswith('.pls')):
        # Not a playlist file, return as-is
        return normalize_stream_url(url)
    
    try:
        import urllib.request
        logger.info(f"Fetching playlist: {url}")
        
        with urllib.request.urlopen(url, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
        
        # Parse .m3u format
        if url.lower().endswith('.m3u'):
            for line in content.split('\n'):
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                # Found a stream URL
                logger.info(f"Extracted from .m3u: {line}")
                return normalize_stream_url(line)
        
        # Parse .pls format
        elif url.lower().endswith('.pls'):
            # Look for File1=, File2=, etc. lines
            for line in content.split('\n'):
                line = line.strip()
                if line.lower().startswith('file'):
                    # Extract URL after '='
                    if '=' in line:
                        stream_url = line.split('=', 1)[1].strip()
                        if stream_url:
                            logger.info(f"Extracted from .pls: {stream_url}")
                            return normalize_stream_url(stream_url)
        
        # Fallback: if no stream found in playlist, return original URL
        logger.warning(f"No stream URL found in playlist, using original URL")
        return normalize_stream_url(url)
    
    except Exception as e:
        logger.error(f"Failed to parse playlist {url}: {e}")
        # On error, return the original URL normalized
        return normalize_stream_url(url)


def load_config():
    """Load bot configuration from toast.json"""
    try:
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Configuration file not found: {CONFIG_PATH}")
        raise
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in configuration file: {CONFIG_PATH}")
        raise

def coerce_int(value, default: int, minimum: int = None, maximum: int = None) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    if minimum is not None:
        result = max(minimum, result)
    if maximum is not None:
        result = min(maximum, result)
    return result

def coerce_float(value, default: float, minimum: float = None, maximum: float = None) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default
    if minimum is not None:
        result = max(minimum, result)
    if maximum is not None:
        result = min(maximum, result)
    return result

def get_groq_config() -> dict:
    groq_config = config.get('groq', {})
    if not isinstance(groq_config, dict):
        groq_config = {}

    return {
        'api_key': str(groq_config.get('api_key', '')).strip(),
        'model': str(groq_config.get('model', DEFAULT_GROQ_MODEL)).strip() or DEFAULT_GROQ_MODEL,
        'vision_model': str(groq_config.get('vision_model', DEFAULT_GROQ_VISION_MODEL)).strip() or DEFAULT_GROQ_VISION_MODEL,
        'temperature': coerce_float(groq_config.get('temperature'), 0.8, 0.0, 2.0),
        'top_p': coerce_float(groq_config.get('top_p'), 0.95, 0.0, 1.0),
        'max_completion_tokens': coerce_int(groq_config.get('max_completion_tokens'), 700, 1, 4096),
        'timeout_seconds': coerce_int(groq_config.get('timeout_seconds'), 30, 5, 120),
        'max_history_messages': coerce_int(groq_config.get('max_history_messages'), 12, 0, 30),
        'max_vision_images': coerce_int(groq_config.get('max_vision_images'), 5, 0, 5),
    }

def normalize_prompt_items(items) -> list:
    if not isinstance(items, list):
        return []
    normalized = []
    for item in items:
        text = str(item).strip()
        if text:
            normalized.append(text)
    return normalized

def load_personality_prompt() -> str:
    try:
        raw = PERSONALITY_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        logger.warning(f"Personality file not found: {PERSONALITY_PATH}; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY
    except Exception as e:
        logger.warning(f"Failed to read personality file: {e}; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY

    if raw == '':
        logger.warning(f"Personality file is empty: {PERSONALITY_PATH}; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"Invalid personality JSON: {e}; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY

    if not isinstance(data, dict):
        logger.warning("Personality JSON must be an object; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY

    system_prompt = str(data.get('system_prompt', '')).strip()
    if not system_prompt:
        logger.warning("Personality JSON missing system_prompt; using fallback Toast prompt")
        return DEFAULT_TOAST_PERSONALITY

    prompt_parts = [system_prompt]
    style_rules = normalize_prompt_items(data.get('style_rules'))
    if style_rules:
        prompt_parts.append("Style rules:\n" + "\n".join(f"- {rule}" for rule in style_rules))

    do_not = normalize_prompt_items(data.get('do_not'))
    if do_not:
        prompt_parts.append("Do not:\n" + "\n".join(f"- {rule}" for rule in do_not))

    private_lore = str(data.get('private_lore', '')).strip()
    if private_lore:
        prompt_parts.append(
            "Private lore, only to share if the user directly asks about your origin, lore, backstory, life, or purpose:\n"
            f"{private_lore}\n"
            "Do not bring this up unprompted."
        )

    prompt_parts.append(
        "You are replying in a private Discord DM. Keep replies natural, conversational, and appropriately brief."
    )
    return "\n\n".join(prompt_parts)

def build_bot_purpose_context() -> str:
    stream_config = config.get('stream', {})
    stream_name = str(stream_config.get('name', '')).strip()
    stream_url = str(stream_config.get('url', '')).strip()

    radio_line = "You play the fridg3.org radio stream in Discord voice channels."
    if stream_name:
        radio_line = f"You play the fridg3.org radio stream in Discord voice channels. The current stream is {stream_name}."
    if stream_url:
        radio_line += " You do not need to mention the raw stream URL unless someone specifically asks for it."

    return (
        "Toast's bot duties and limits:\n"
        f"- {radio_line}\n"
        "- Your only Discord slash commands are /play, /stop, /status, and /sendmsg. Do not invent or suggest any other Discord slash commands.\n"
        "- Website paths like /feed, /journal, /chat, /settings, and /tools are fridg3.org pages, not Discord slash commands.\n"
        "- If someone asks how to use a website feature, direct them to the relevant fridg3.org page or describe the website flow; do not turn website paths into Discord commands.\n"
        "- You send useful DMs for fridg3.org events, including account invites, feed mentions, and replies to a user's feed posts.\n"
        "- You help keep the website connected to Discord, including account linking and notification delivery.\n"
        "- In this AI DM chat, you can explain these duties and answer questions, but you should not claim you personally changed settings, joined voice, or sent admin notifications unless the current conversation or bot code actually did that.\n"
        "- If someone asks for an action that needs admin tools or server slash commands, tell them the practical next step instead of pretending it already happened."
    )

def tokenize_context_query(text: str) -> set:
    return {
        token
        for token in re.findall(r'[a-z0-9]+', (text or '').lower())
        if len(token) >= 3
    }

def should_include_wiki_context(user_text: str) -> bool:
    tokens = tokenize_context_query(user_text)
    if tokens & WIKI_CONTEXT_TRIGGER_TERMS:
        return True
    return bool(re.search(r'/(feed|journal|chat|contact|settings|music|gallery|tools|others|discord|account)\b', user_text or '', re.I))

def read_wiki_context_sections() -> list:
    sections = []
    for filename in WIKI_CONTEXT_FILES:
        path = WIKI_DIR / filename
        try:
            raw = path.read_text(encoding='utf-8')
        except Exception as e:
            logger.warning(f"Failed to read wiki context file {path}: {e}")
            continue

        current_title = filename
        current_lines = []
        for line in raw.splitlines():
            heading_match = re.match(r'^(#{1,3})\s+(.+?)\s*$', line)
            if heading_match:
                if current_lines:
                    sections.append({
                        'source': filename,
                        'title': current_title,
                        'body': '\n'.join(current_lines).strip(),
                    })
                current_title = heading_match.group(2).strip()
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            sections.append({
                'source': filename,
                'title': current_title,
                'body': '\n'.join(current_lines).strip(),
            })
    return sections

def score_wiki_section(section: dict, query_tokens: set) -> int:
    title = str(section.get('title', '')).lower()
    body = str(section.get('body', '')).lower()
    score = 0
    for token in query_tokens:
        if token in title:
            score += 5
        if re.search(rf'\b{re.escape(token)}\b', body):
            score += 1
    return score

def build_wiki_context_for_message(user_text: str) -> str:
    if not should_include_wiki_context(user_text):
        return ''

    query_tokens = tokenize_context_query(user_text)
    sections = read_wiki_context_sections()
    scored_sections = [
        (score_wiki_section(section, query_tokens), section)
        for section in sections
    ]
    relevant_sections = [
        section
        for score, section in sorted(scored_sections, key=lambda item: item[0], reverse=True)
        if score > 0
    ][:5]

    if not relevant_sections:
        relevant_sections = [
            section for section in sections
            if section.get('source') == 'Home.md' and section.get('title') in ('Project Snapshot', 'fridg3.org Developer Wiki')
        ][:2]

    if not relevant_sections:
        return ''

    context_parts = []
    total_length = 0
    for section in relevant_sections:
        body = re.sub(r'\n{3,}', '\n\n', section.get('body', '')).strip()
        if not body:
            continue
        chunk = f"From wiki/{section['source']} - {section['title']}:\n{body}"
        if total_length + len(chunk) > WIKI_CONTEXT_MAX_CHARS:
            remaining = WIKI_CONTEXT_MAX_CHARS - total_length
            if remaining < 500:
                break
            chunk = chunk[:remaining].rsplit('\n', 1)[0].strip()
        context_parts.append(chunk)
        total_length += len(chunk)

    if not context_parts:
        return ''

    return (
        "Relevant fridg3.org wiki context follows. Use it only when it helps answer the user's question. "
        "Explain it in plain, non-dev language; do not say 'according to the wiki' unless naming the source is useful. "
        "If the context does not answer the question, say so and keep the reply honest.\n\n"
        + "\n\n---\n\n".join(context_parts)
    )

def update_bot_status(status: str):
    """Deprecated: retained for compatibility but no longer writes to disk."""
    logger.info(f"Ignoring request to persist bot status: {status}")

async def update_discord_presence():
    """Update Discord presence to show current stream name"""
    try:
        stream_name = config.get('stream', {}).get('name', 'Unknown Stream')
        activity = discord.Activity(type=discord.ActivityType.listening, name=stream_name)
        await bot.change_presence(activity=activity)
        logger.info(f"Updated Discord presence: Listening to {stream_name}")
    except Exception as e:
        logger.error(f"Failed to update Discord presence: {e}")

# Load config on startup
config = load_config()

signal_file_path = CONFIG_PATH.parent / '.stream-update-signal'
feed_notify_state_path = CONFIG_PATH.parent / 'toast-feed-notify-state.json'
dm_history_path = CONFIG_PATH.parent / 'toast-dm-history.json'

# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
bot_online = False

MENTION_PATTERN = re.compile(r'@([A-Za-z0-9_-]{1,50})')

def find_accounts_path():
    cur = Path(__file__).resolve().parent
    root = cur
    while True:
        candidate = root / 'data' / 'accounts' / 'accounts.json'
        if candidate.exists():
            return candidate
        if root.parent == root:
            break
        root = root.parent
    return Path(__file__).resolve().parent.parent / 'data' / 'accounts' / 'accounts.json'

def find_feed_posts_dir():
    cur = Path(__file__).resolve().parent
    root = cur
    while True:
        candidate = root / 'data' / 'feed'
        if candidate.exists():
            return candidate
        if root.parent == root:
            break
        root = root.parent
    return Path(__file__).resolve().parent.parent / 'data' / 'feed'

def load_accounts_index():
    accounts_path = find_accounts_path()
    try:
        with open(accounts_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load accounts.json: {e}")
        return {}

    index = {}
    for account in data.get('accounts', []):
        if not isinstance(account, dict):
            continue
        username = str(account.get('username', '')).strip()
        if not username:
            continue
        discord_user_id = str(account.get('discordUserId', '')).strip()
        index[username.lower()] = {
            'username': username,
            'discord_user_id': discord_user_id,
        }
    return index

def parse_feed_post(post_path: Path):
    try:
        raw = post_path.read_text(encoding='utf-8')
    except Exception as e:
        logger.warning(f"Failed to read feed post {post_path}: {e}")
        return None

    lines = re.split(r'\r\n|\n|\r', raw)
    username = lines[0].strip().lstrip('@') if len(lines) > 0 else ''
    date_line = lines[1].strip() if len(lines) > 1 else ''
    body = '\n'.join(lines[2:]) if len(lines) > 2 else ''
    if not username:
        return None
    return {
        'id': post_path.stem,
        'username': username,
        'date': date_line,
        'body': body,
        'path': post_path,
    }

def load_feed_posts():
    posts_dir = find_feed_posts_dir()
    posts = {}
    try:
        for post_path in posts_dir.glob('*.txt'):
            parsed = parse_feed_post(post_path)
            if parsed:
                posts[parsed['id']] = parsed
    except Exception as e:
        logger.error(f"Failed to scan feed posts: {e}")
    return posts

def load_feed_replies():
    replies_dir = find_feed_posts_dir() / 'replies'
    reply_index = {}
    if not replies_dir.exists():
        return reply_index

    for reply_path in replies_dir.glob('*.json'):
        post_id = reply_path.stem
        try:
            data = json.loads(reply_path.read_text(encoding='utf-8'))
        except Exception as e:
            logger.warning(f"Failed to read replies file {reply_path}: {e}")
            continue

        replies = data.get('replies', [])
        if not isinstance(replies, list):
            continue

        normalized = []
        for idx, reply in enumerate(replies):
            if not isinstance(reply, dict):
                continue
            username = str(reply.get('username', '')).strip().lstrip('@')
            body = str(reply.get('body', ''))
            date_line = str(reply.get('date', '')).strip()
            reply_id = str(reply.get('id', '')).strip()
            if not reply_id:
                seed = f"{username}|{date_line}|{body}|{idx}"
                reply_id = 'legacy_' + hashlib.sha1(seed.encode('utf-8')).hexdigest()[:16]
            if not username or not date_line or not body.strip():
                continue
            normalized.append({
                'id': reply_id,
                'username': username,
                'body': body,
                'date': date_line,
            })
        reply_index[post_id] = normalized

    return reply_index

def extract_mentions(body: str, accounts_index: dict):
    mentions = []
    seen = set()
    for match in MENTION_PATTERN.finditer(body or ''):
        username_raw = match.group(1)
        key = username_raw.lower()
        if key in seen:
            continue
        account = accounts_index.get(key)
        if not account or not account.get('discord_user_id'):
            continue
        seen.add(key)
        mentions.append(account)
    return mentions

def load_notify_state():
    if not feed_notify_state_path.exists():
        return None
    try:
        with open(feed_notify_state_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        return data
    except Exception as e:
        logger.warning(f"Failed to load notify state: {e}")
        return None

def load_dm_history():
    if not dm_history_path.exists():
        return {'threads': {}}
    try:
        with open(dm_history_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {'threads': {}}
        threads = data.get('threads', {})
        if not isinstance(threads, dict):
            threads = {}
        return {'threads': threads}
    except Exception as e:
        logger.warning(f"Failed to load DM history: {e}")
        return {'threads': {}}

def save_dm_history(history: dict):
    try:
        with open(dm_history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save DM history: {e}")

def build_dm_content(content: str, attachments=None) -> str:
    parts = []
    text = (content or '').strip()
    if text:
        parts.append(text)

    attachment_urls = []
    for attachment in attachments or []:
        url = getattr(attachment, 'url', '')
        if url:
            attachment_urls.append(url)

    if attachment_urls:
        parts.extend(attachment_urls)

    return '\n'.join(parts).strip() or '[no text]'

def build_user_snapshot(user) -> dict:
    avatar = getattr(user, 'display_avatar', None)
    avatar_url = ''
    if avatar is not None:
        try:
            avatar_url = str(avatar.url)
        except Exception:
            avatar_url = ''

    return {
        'discord_user_id': str(user.id),
        'username': getattr(user, 'name', '') or '',
        'global_name': getattr(user, 'global_name', '') or '',
        'display_name': getattr(user, 'display_name', '') or getattr(user, 'name', '') or '',
        'avatar_url': avatar_url,
    }

def append_dm_history_entry(user, direction: str, content: str, timestamp=None, message_id=''):
    history = load_dm_history()
    threads = history.setdefault('threads', {})

    user_snapshot = build_user_snapshot(user)
    discord_user_id = user_snapshot['discord_user_id']
    thread = threads.get(discord_user_id)
    if not isinstance(thread, dict):
        thread = {
            'discord_user_id': discord_user_id,
            'messages': [],
        }

    thread.update(user_snapshot)

    if timestamp is None:
        timestamp_value = discord.utils.utcnow()
    else:
        timestamp_value = timestamp

    if hasattr(timestamp_value, 'isoformat'):
        timestamp_string = timestamp_value.isoformat()
    else:
        timestamp_string = str(timestamp_value)

    messages = thread.get('messages', [])
    if not isinstance(messages, list):
        messages = []

    messages.append({
        'id': str(message_id or ''),
        'direction': direction,
        'content': content,
        'timestamp': timestamp_string,
    })

    if len(messages) > 250:
        messages = messages[-250:]

    thread['messages'] = messages
    thread['updated_at'] = timestamp_string
    threads[discord_user_id] = thread
    save_dm_history(history)

def is_memory_clear_message(content: str) -> bool:
    return (content or '').strip() == DM_MEMORY_CLEAR_PHRASE

def get_recent_dm_messages(discord_user_id: str, limit: int, exclude_message_id: str = '') -> list:
    if limit <= 0:
        return []

    history = load_dm_history()
    thread = history.get('threads', {}).get(str(discord_user_id), {})
    messages = thread.get('messages', [])
    if not isinstance(messages, list):
        return []

    newest_clear_index = None
    for index, entry in enumerate(messages):
        if not isinstance(entry, dict):
            continue
        if entry.get('direction') == 'inbound' and is_memory_clear_message(str(entry.get('content', ''))):
            newest_clear_index = index
    if newest_clear_index is not None:
        messages = messages[newest_clear_index + 1:]

    recent = []
    for entry in messages[-limit:]:
        if not isinstance(entry, dict):
            continue
        if exclude_message_id and str(entry.get('id', '')) == str(exclude_message_id):
            continue
        direction = entry.get('direction')
        if direction == 'inbound':
            role = 'user'
        elif direction == 'outbound':
            role = 'assistant'
        else:
            continue

        content = str(entry.get('content', '')).strip()
        if not content:
            continue
        recent.append({'role': role, 'content': content})
    return recent

def is_vision_attachment(attachment) -> bool:
    url = str(getattr(attachment, 'url', '') or '').strip()
    if not url:
        return False

    filename = str(getattr(attachment, 'filename', '') or '').lower()
    suffix = Path(filename).suffix
    content_type = str(getattr(attachment, 'content_type', '') or '').lower()
    if suffix not in VISION_IMAGE_EXTENSIONS and not content_type.startswith('image/'):
        return False
    if suffix == '.svg' or content_type == 'image/svg+xml':
        return False

    size = getattr(attachment, 'size', 0) or 0
    try:
        size = int(size)
    except (TypeError, ValueError):
        size = 0
    if size > VISION_IMAGE_SIZE_LIMIT_BYTES:
        logger.warning(f"Skipping oversized image attachment for vision: filename={filename} size={size}")
        return False
    return True

def get_vision_attachments(attachments, max_images: int) -> list:
    if max_images <= 0:
        return []

    vision_attachments = []
    for attachment in attachments or []:
        if not is_vision_attachment(attachment):
            continue
        filename = str(getattr(attachment, 'filename', '') or '').strip()
        url = str(getattr(attachment, 'url', '') or '').strip()
        content_type = str(getattr(attachment, 'content_type', '') or '').strip()
        is_gif = filename.lower().endswith('.gif') or content_type.lower() == 'image/gif'
        vision_attachments.append({
            'filename': filename or 'image',
            'url': url,
            'content_type': content_type,
            'is_gif': is_gif,
        })
        if len(vision_attachments) >= max_images:
            break
    return vision_attachments

def build_current_user_content(current_message: str, vision_attachments: list):
    text = (current_message or '').strip()
    if not vision_attachments:
        return text or '[no text]'

    attachment_names = ', '.join(item['filename'] for item in vision_attachments)
    gif_count = sum(1 for item in vision_attachments if item.get('is_gif'))
    visual_note = f"The user attached {len(vision_attachments)} image(s): {attachment_names}."
    if gif_count:
        visual_note += " At least one attachment is a GIF; describe visible content, but do not overclaim motion if only a still/representative frame is available."

    content_blocks = [{'type': 'text', 'text': (text + '\n\n' if text else '') + visual_note}]
    for attachment in vision_attachments:
        content_blocks.append({
            'type': 'image_url',
            'image_url': {'url': attachment['url']},
        })
    return content_blocks

def build_groq_messages(user, history_limit: int, current_message: str = '', attachments=None, current_message_id: str = '') -> list:
    groq_config = get_groq_config()
    vision_attachments = get_vision_attachments(attachments, groq_config['max_vision_images'])
    messages = [
        {'role': 'system', 'content': load_personality_prompt()},
        {'role': 'system', 'content': build_bot_purpose_context()},
    ]
    wiki_context = build_wiki_context_for_message(current_message)
    if wiki_context:
        messages.append({'role': 'system', 'content': wiki_context})
    if vision_attachments:
        messages.append({
            'role': 'system',
            'content': (
                "The user's latest DM includes visual attachments. Answer based on what is visible. "
                "For memes or GIFs, explain the joke casually if it is obvious. If the image is unclear, say so instead of guessing."
            ),
        })
    messages.extend(get_recent_dm_messages(str(user.id), history_limit, current_message_id))
    messages.append({
        'role': 'user',
        'content': build_current_user_content(current_message, vision_attachments),
    })
    return messages

def split_natural_messages(text: str, max_length: int = 1800, soft_length: int = 500) -> list:
    cleaned = (text or '').strip()
    if not cleaned:
        return []
    if len(cleaned) <= soft_length:
        return [cleaned]

    chunks = []
    remaining = cleaned
    while len(remaining) > soft_length:
        split_at = -1
        target = min(max_length, max(soft_length, int(len(remaining) / 2)) if len(remaining) <= soft_length * 2 else soft_length)
        search_window = remaining[:target + 1]

        for separator in ('\n\n', '\n', '. ', '! ', '? ', '; ', ', '):
            candidate = search_window.rfind(separator)
            if candidate >= int(target * 0.45):
                split_at = candidate + len(separator)
                break

        if split_at < 0:
            split_at = search_window.rfind(' ')
        if split_at < int(target * 0.45):
            split_at = min(max_length, target)

        chunk = remaining[:split_at].strip()
        if chunk:
            chunks.append(chunk)
        remaining = remaining[split_at:].strip()

    if remaining:
        chunks.append(remaining)
    return chunks

def typing_delay_seconds(text: str) -> float:
    length = len(text or '')
    return min(12.0, max(1.4, length / 38))

def followup_typing_delay_seconds(text: str) -> float:
    length = len(text or '')
    return min(3.0, max(0.9, length / 160))

async def request_groq_dm_reply(user, current_message: str, attachments=None, current_message_id: str = '') -> str:
    groq_config = get_groq_config()
    api_key = groq_config['api_key']
    if not api_key:
        logger.warning("Groq API key missing from toast.json; skipping AI DM reply")
        return ''

    vision_attachments = get_vision_attachments(attachments, groq_config['max_vision_images'])
    model = groq_config['vision_model'] if vision_attachments else groq_config['model']
    payload = {
        'model': model,
        'messages': build_groq_messages(
            user,
            groq_config['max_history_messages'],
            current_message,
            attachments,
            current_message_id,
        ),
        'temperature': groq_config['temperature'],
        'top_p': groq_config['top_p'],
        'max_completion_tokens': groq_config['max_completion_tokens'],
    }
    headers = {
        'Authorization': f"Bearer {api_key}",
        'Content-Type': 'application/json',
    }
    timeout = ClientTimeout(total=groq_config['timeout_seconds'])

    async with ClientSession(timeout=timeout) as session:
        async with session.post(GROQ_CHAT_COMPLETIONS_URL, headers=headers, json=payload) as response:
            response_text = await response.text()
            if response.status >= 400:
                logger.warning(f"Groq DM reply failed: status={response.status} body={response_text[:500]}")
                return ''

            try:
                data = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.warning(f"Groq returned invalid JSON: {e}")
                return ''

    choices = data.get('choices', [])
    if not choices or not isinstance(choices, list):
        logger.warning("Groq response had no choices")
        return ''

    message = choices[0].get('message', {})
    content = str(message.get('content', '')).strip() if isinstance(message, dict) else ''
    if not content:
        logger.warning("Groq response content was empty")
    return content

async def respond_to_dm_with_groq(message: discord.Message):
    groq_config = get_groq_config()
    if not groq_config['api_key']:
        logger.warning("Groq API key missing from toast.json; skipping AI DM reply")
        return

    async with message.channel.typing():
        try:
            reply = await request_groq_dm_reply(
                message.author,
                build_dm_content(message.content, message.attachments),
                message.attachments,
                str(getattr(message, 'id', '')),
            )
        except Exception as e:
            logger.warning(f"Groq DM reply request crashed: {e}")
            reply = ''
        if not reply:
            await send_logged_dm(message.author, GROQ_FALLBACK_REPLY)
            return

        chunks = split_natural_messages(reply)
        if not chunks:
            await send_logged_dm(message.author, GROQ_FALLBACK_REPLY)
            return

        for index, chunk in enumerate(chunks):
            await asyncio.sleep(typing_delay_seconds(chunk))
            await send_logged_dm(message.author, chunk)
            if index < len(chunks) - 1:
                await asyncio.sleep(followup_typing_delay_seconds(chunks[index + 1]))

async def send_logged_dm(target, message: str):
    if isinstance(target, (discord.User, discord.Member)):
        user = target
    else:
        user = await bot.fetch_user(int(str(target)))

    sent_message = await user.send(message)
    append_dm_history_entry(
        user,
        'outbound',
        build_dm_content(message),
        timestamp=getattr(sent_message, 'created_at', None),
        message_id=getattr(sent_message, 'id', ''),
    )
    return user, sent_message

def build_dm_error_response(error: Exception, action: str):
    if isinstance(error, discord.Forbidden):
        return web.json_response(
            {
                'ok': False,
                'error': 'discord rejected the DM. the user likely has direct messages disabled or has blocked the bot',
            },
            status=403,
        )
    if isinstance(error, discord.NotFound):
        return web.json_response(
            {
                'ok': False,
                'error': f'could not find the discord user while trying to {action}',
            },
            status=404,
        )
    if isinstance(error, discord.HTTPException):
        logger.warning(f"Discord HTTP error while trying to {action}: status={error.status} code={error.code} text={error.text}")
        return web.json_response(
            {
                'ok': False,
                'error': f'discord API error while trying to {action}',
                'discord_status': error.status,
                'discord_code': error.code,
            },
            status=502,
        )

    logger.warning(f"Unexpected error while trying to {action}: {error}")
    return web.json_response(
        {
            'ok': False,
            'error': f'unexpected error while trying to {action}',
        },
        status=500,
    )

def save_notify_state(state: dict):
    try:
        with open(feed_notify_state_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save notify state: {e}")

def build_initial_notify_state(posts: dict, replies: dict, accounts_index: dict):
    return {
        'mentions': sorted(
            f"{post_id}:{target['username'].lower()}"
            for post_id, post in posts.items()
            for target in extract_mentions(post.get('body', ''), accounts_index)
        ),
        'replies': sorted(
            f"{post_id}:{reply.get('id', '')}"
            for post_id, items in replies.items()
            for reply in items
            if reply.get('id')
        ),
    }

async def send_dm_to_user(discord_user_id: str, message: str):
    try:
        await send_logged_dm(discord_user_id, message)
        return True
    except Exception as e:
        logger.warning(f"Failed to DM user {discord_user_id}: {e}")
        return False

def format_quote_block(text: str, max_length: int = 240) -> str:
    cleaned = ' '.join((text or '').strip().split())
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length - 3].rstrip() + '...'
    return cleaned or '[no text]'

@tasks.loop(seconds=20)
async def feed_notifications_monitor():
    try:
        accounts_index = load_accounts_index()
        posts = load_feed_posts()
        replies = load_feed_replies()

        state = load_notify_state()
        if state is None:
            state = build_initial_notify_state(posts, replies, accounts_index)
            save_notify_state(state)
            logger.info("Initialized feed notification state without sending backlog DMs")
            return

        mention_state = set(state.get('mentions', []))
        reply_state = set(state.get('replies', []))

        mention_state_changed = False
        reply_state_changed = False

        for post_id, post in posts.items():
            author_key = post['username'].lower()
            for target in extract_mentions(post.get('body', ''), accounts_index):
                target_key = target['username'].lower()
                notification_key = f"{post_id}:{target_key}"
                if notification_key in mention_state:
                    continue
                mention_state.add(notification_key)
                mention_state_changed = True
                if target_key == author_key:
                    continue
                discord_user_id = target.get('discord_user_id', '')
                if not discord_user_id:
                    continue
                await send_dm_to_user(
                    discord_user_id,
                    f"**@{post['username']}** mentioned you in [a /feed/ post](https://fridg3.org/feed/posts/{post_id}):\n"
                    f"> \"{format_quote_block(post.get('body', ''))}\""
                )

        for post_id, post_replies in replies.items():
            post = posts.get(post_id)
            if not post:
                continue
            post_owner = accounts_index.get(post['username'].lower())
            post_owner_discord_id = (post_owner or {}).get('discord_user_id', '')
            for reply in post_replies:
                reply_id = reply.get('id', '')
                if not reply_id:
                    continue
                notification_key = f"{post_id}:{reply_id}"
                if notification_key in reply_state:
                    continue
                reply_state.add(notification_key)
                reply_state_changed = True
                if not post_owner_discord_id:
                    continue
                if reply['username'].lower() == post['username'].lower():
                    continue
                await send_dm_to_user(
                    post_owner_discord_id,
                    f"**@{reply['username']}** replied to [your /feed/ post](https://fridg3.org/feed/posts/{post_id}):\n"
                    f"> \"{format_quote_block(reply.get('body', ''))}\""
                )

        if mention_state_changed or reply_state_changed:
            state['mentions'] = sorted(mention_state)
            state['replies'] = sorted(reply_state)
            save_notify_state(state)
    except Exception as e:
        logger.error(f"Feed notification monitor error: {e}")

@feed_notifications_monitor.before_loop
async def before_feed_notifications_monitor():
    await bot.wait_until_ready()

# Local status server for PHP to query instead of reading toast.json
status_app = web.Application()

@bot.event
async def on_ready():
    """Called when the bot connects to Discord"""
    global bot_online
    bot_online = True
    logger.info(f"Bot logged in as {bot.user}")
    logger.info(f"Bot ID: {bot.user.id}")
    
    # Update Discord presence with stream name
    await update_discord_presence()

    # Sync slash commands (one-time per connect)
    try:
        synced = await bot.tree.sync()
        logger.info(f"Synced {len(synced)} application commands")
    except Exception as e:
        logger.error(f"Failed to sync application commands: {e}")
    
    # Try to join the voice channel and start playing
    await auto_play_stream()

@bot.event
async def on_disconnect():
    """Called when the bot disconnects from Discord"""
    global bot_online
    bot_online = False
    logger.info("Bot disconnected from Discord")

@bot.event
async def on_message(message: discord.Message):
    if isinstance(message.channel, discord.DMChannel) and not message.author.bot:
        dm_content = build_dm_content(message.content, message.attachments)
        append_dm_history_entry(
            message.author,
            'inbound',
            dm_content,
            timestamp=getattr(message, 'created_at', None),
            message_id=getattr(message, 'id', ''),
        )
        if is_memory_clear_message(dm_content):
            try:
                await message.add_reaction('✅')
            except Exception as e:
                logger.warning(f"Failed to react to memory clear DM: {e}")
            await bot.process_commands(message)
            return
        await respond_to_dm_with_groq(message)

    await bot.process_commands(message)

@tasks.loop(seconds=1)  # Check every second for immediate stream restart signal
async def config_monitor():
    """Monitor for stream update signal and reload config + restart playback immediately"""
    global config
    try:
        if signal_file_path.exists():
            logger.info("Stream update signal detected, reloading config and restarting stream...")
            # Reload config from file
            try:
                old_stream_name = config.get('stream', {}).get('name', 'Unknown')
                config = load_config()
                new_stream_name = config.get('stream', {}).get('name', 'Unknown')
            except Exception as e:
                logger.error(f"Failed to reload config: {e}")
                return
            
            # Stop current playback
            for vc in bot.voice_clients:
                if vc.is_playing():
                    vc.stop()
                await vc.disconnect()
            
            # Update Discord presence with new stream name
            await update_discord_presence()
            
            # Start new stream
            await auto_play_stream()
            
            # Remove signal file
            try:
                signal_file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to remove signal file: {e}")
    except Exception as e:
        logger.error(f"Config monitor error: {e}")

@tasks.loop(seconds=300)  # Check every 5 minutes
async def heartbeat():
    """Periodic check to ensure bot is still connected and playing"""
    try:
        channel = bot.get_channel(int(config['channel']['id']))
        if channel and isinstance(channel, discord.VoiceChannel):
            # Check if bot is in channel; if not, try to rejoin
            if not any(member.id == bot.user.id for member in channel.members):
                logger.warning(f"Bot disconnected from {channel.name}, attempting to rejoin...")
                await auto_play_stream()
    except Exception as e:
        logger.error(f"Heartbeat check failed: {e}")

async def auto_play_stream():
    """Connect to voice channel and play the m3u stream"""
    try:
        channel_id = int(config['channel']['id'])
        raw_url = config['stream'].get('url', '')
        # Parse playlist if needed, then normalize the URL
        stream_url = parse_playlist(raw_url)
        logger.info(f"Using stream URL: {stream_url}")
        
        channel = bot.get_channel(channel_id)
        if not channel:
            logger.error(f"Voice channel {channel_id} not found")
            return
        
        if not isinstance(channel, discord.VoiceChannel):
            logger.error(f"Channel {channel_id} is not a voice channel")
            return
        
        # Disconnect if already connected
        for vc in bot.voice_clients:
            if vc.channel == channel:
                await vc.disconnect()
        
        # Connect to the voice channel
        voice_client = await channel.connect()
        logger.info(f"Connected to voice channel: {channel.name}")
        
        # Play the m3u stream
        # Using FFmpeg to stream the URL
        ffmpeg_exec = config.get('stream', {}).get('ffmpeg_executable') or FFMPEG_EXE
        if not ffmpeg_exec:
            logger.error('ffmpeg executable not found. Aborting playback. Ensure ffmpeg is installed and on PATH or set stream.ffmpeg_executable in config.')
            return
        audio_source = discord.FFmpegPCMAudio(
            stream_url,
            executable=ffmpeg_exec,
            before_options="-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
            options="-vn -b:a 192k"
        )
        
        voice_client.play(
            audio_source,
            after=lambda e: logger.error(f"Player error: {e}") if e else None
        )
        
        logger.info(f"Started playing stream: {config['stream']['name']}")
        
    except Exception as e:
        logger.error(f"Failed to play stream: {e}")

@bot.tree.command(name="play", description="Start the toast radio stream")
async def slash_play(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    await auto_play_stream()
    await interaction.followup.send(f"🎵 Now playing: {config['stream']['name']}", ephemeral=True)

@bot.tree.command(name="stop", description="Stop playback and disconnect")
async def slash_stop(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    for vc in bot.voice_clients:
        await vc.disconnect()
    await interaction.followup.send("⏹️ Stopped playback", ephemeral=True)

@bot.tree.command(name="status", description="Show bot status")
async def slash_status(interaction: discord.Interaction):
    voice_clients = bot.voice_clients
    if voice_clients:
        vc = voice_clients[0]
        is_playing = vc.is_playing()
        status_str = f"▶️ Playing {config['stream']['name']}" if is_playing else "⏸️ Connected but not playing"
    else:
        status_str = "⭕ Disconnected"
    await interaction.response.send_message(f"Bot Status: {status_str}", ephemeral=True)

@bot.tree.command(name="sendmsg", description="DM everyone in a role")
@app_commands.default_permissions(administrator=True)
@app_commands.describe(role_id="Discord role ID", message="Message to DM to each member")
async def slash_sendmsg(interaction: discord.Interaction, role_id: str, message: str):
    if interaction.guild is None:
        await interaction.response.send_message("this command only works in a server.", ephemeral=True)
        return

    guild_permissions = getattr(interaction.user, 'guild_permissions', None)
    if not guild_permissions or not guild_permissions.administrator:
        await interaction.response.send_message("you need administrator permissions to use this command.", ephemeral=True)
        return

    if not re.fullmatch(r'\d{17,20}', role_id.strip()):
        await interaction.response.send_message("role id has to be a valid discord snowflake.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    role = interaction.guild.get_role(int(role_id))
    if role is None:
        await interaction.followup.send("couldn't find a role with that id in this server.", ephemeral=True)
        return

    recipients = [member for member in role.members if not member.bot]
    if not recipients:
        await interaction.followup.send("that role has no non-bot members to message.", ephemeral=True)
        return

    sent_count = 0
    failed_count = 0
    for member in recipients:
        try:
            await send_logged_dm(member, message)
            sent_count += 1
        except Exception as e:
            failed_count += 1
            logger.warning(f"Failed to send role DM to {member} ({member.id}): {e}")

    await interaction.followup.send(
        f"done. sent `{sent_count}` dm(s) to `{role.name}`" + (f", `{failed_count}` failed." if failed_count else "."),
        ephemeral=True
    )

async def status_handler(request):
    return web.json_response({
        'online': bot_online and not bot.is_closed(),
        'stream_name': config.get('stream', {}).get('name', 'Unknown Stream')
    })

async def find_registered_role():
    try:
        channel_id = int(config['channel']['id'])
    except Exception:
        return None, None

    channel = bot.get_channel(channel_id)
    if not channel or not isinstance(channel, discord.abc.GuildChannel):
        return None, None

    guild = channel.guild
    role = discord.utils.find(lambda r: r.name.lower() == 'registered', guild.roles)
    return guild, role

async def link_discord_handler(request):
    if request.remote not in ('127.0.0.1', '::1'):
        return web.json_response({'ok': False, 'error': 'forbidden'}, status=403)

    try:
        payload = await request.json()
    except Exception:
        return web.json_response({'ok': False, 'error': 'invalid json'}, status=400)

    discord_user_id = str(payload.get('discord_user_id', '')).strip()
    site_username = str(payload.get('site_username', '')).strip()
    if not re.fullmatch(r'\d{17,20}', discord_user_id):
        return web.json_response({'ok': False, 'error': 'invalid discord user id'}, status=400)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,50}', site_username):
        return web.json_response({'ok': False, 'error': 'invalid site username'}, status=400)

    guild, role = await find_registered_role()
    if guild is None:
        return web.json_response({'ok': False, 'error': 'bot guild not available'}, status=503)
    if role is None:
        return web.json_response({'ok': False, 'error': 'registered role not found'}, status=500)

    member = guild.get_member(int(discord_user_id))
    if member is None:
        try:
            member = await guild.fetch_member(int(discord_user_id))
        except Exception:
            member = None

    if member is None:
        return web.json_response({'ok': False, 'error': 'user is not in the discord server'}, status=404)

    try:
        if role not in member.roles:
            await member.add_roles(role, reason='fridg3.org account linked')
        await send_logged_dm(
            member,
            f"Your Discord account has been linked to the account `@{site_username}` on **fridg3.org**.\n\n"
            "If this wasn't you, don't worry. **Your Discord account is *not* compromised**. \n"
            "Just send a message to <@609510856811741428> and your Discord will be unlinked.\n\n"
            "You'll receive messages from me whenever any of the following happens:\n"
            "- Someone mentions you in a /feed/ post\n"
            "- Someone replies to one of your /feed/ posts\n"
            "- There's an important update you'll want to be notified of\n\n"
            "If you need to edit any account information, speak to <@609510856811741428>.\n"
            "Until then, sit back and enjoy the silence. I'll be in contact."
        )
    except Exception as e:
        logger.warning(f"Failed to complete discord linking for {discord_user_id}: {e}")
        return web.json_response({'ok': False, 'error': 'failed to assign registered role or send confirmation dm'}, status=500)

    return web.json_response({
        'ok': True,
        'guild_id': str(guild.id),
        'role_id': str(role.id),
        'username': str(member),
    })

async def send_account_invite_handler(request):
    if request.remote not in ('127.0.0.1', '::1'):
        return web.json_response({'ok': False, 'error': 'forbidden'}, status=403)

    try:
        payload = await request.json()
    except Exception:
        return web.json_response({'ok': False, 'error': 'invalid json'}, status=400)

    discord_user_id = str(payload.get('discord_user_id', '')).strip()
    site_username = str(payload.get('site_username', '')).strip()
    site_password = str(payload.get('site_password', '')).strip()

    if not re.fullmatch(r'\d{17,20}', discord_user_id):
        return web.json_response({'ok': False, 'error': 'invalid discord user id'}, status=400)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,50}', site_username):
        return web.json_response({'ok': False, 'error': 'invalid site username'}, status=400)
    if site_password == '':
        return web.json_response({'ok': False, 'error': 'missing site password'}, status=400)

    try:
        user = await bot.fetch_user(int(discord_user_id))
    except Exception as e:
        logger.warning(f"Failed to fetch discord user {discord_user_id} for invite: {e}")
        return web.json_response({'ok': False, 'error': 'could not fetch discord user'}, status=404)

    try:
        await send_logged_dm(
            user,
            "## fridg3.org - user account invitation\n"
            "hey, my name is toast and i'm messaging you on behalf of **fridg3.org.**\n"
            "you've been informally invited to having an account on the website!\n\n"
            "### account information\n"
            "below are your account login details. you can log in [here](https://fridg3.org/account/login/).\n"
            "when you log in for the first time, you won't be able to do anything until you change your password.\n"
            f"> **username:** {site_username}\n"
            f"> **password:** ||{site_password}||\n\n"
            "**enjoy using your account!**\n"
            "i'll be here to send you messages whenever you get post replies, or if anything else demands your attention.\n"
            "see you around, and stay safe!"
        )
    except Exception as e:
        logger.warning(f"Failed to send account invite DM to {discord_user_id}: {e}")
        return build_dm_error_response(e, 'send the account invite DM')

    return web.json_response({'ok': True})

async def send_message_handler(request):
    if request.remote not in ('127.0.0.1', '::1'):
        return web.json_response({'ok': False, 'error': 'forbidden'}, status=403)

    try:
        payload = await request.json()
    except Exception:
        return web.json_response({'ok': False, 'error': 'invalid json'}, status=400)

    discord_user_id = str(payload.get('discord_user_id', '')).strip()
    message = str(payload.get('message', '')).strip()

    if not re.fullmatch(r'\d{17,20}', discord_user_id):
        return web.json_response({'ok': False, 'error': 'invalid discord user id'}, status=400)
    if message == '':
        return web.json_response({'ok': False, 'error': 'message cannot be empty'}, status=400)

    try:
        user, sent_message = await send_logged_dm(discord_user_id, message)
    except Exception as e:
        logger.warning(f"Failed to send manual DM to {discord_user_id}: {e}")
        return build_dm_error_response(e, 'send the DM')

    return web.json_response({
        'ok': True,
        'discord_user_id': str(user.id),
        'username': str(user),
        'message_id': str(sent_message.id),
    })

async def contact_notify_handler(request):
    if request.remote not in ('127.0.0.1', '::1'):
        return web.json_response({'ok': False, 'error': 'forbidden'}, status=403)

    try:
        payload = await request.json()
    except Exception:
        return web.json_response({'ok': False, 'error': 'invalid json'}, status=400)

    channel_id = str(payload.get('channel_id', '')).strip()
    submission_id = str(payload.get('id', '')).strip()
    sender_name = str(payload.get('name', '')).strip()
    sender_email = str(payload.get('email', '')).strip()
    message_preview = str(payload.get('message_preview', '')).strip()
    dashboard_url = str(payload.get('dashboard_url', 'https://fridg3.org/contact?dashboard=1')).strip()

    if not re.fullmatch(r'\d{17,20}', channel_id):
        return web.json_response({'ok': False, 'error': 'invalid channel id'}, status=400)
    if submission_id == '':
        return web.json_response({'ok': False, 'error': 'missing submission id'}, status=400)

    channel = bot.get_channel(int(channel_id))
    if channel is None:
        try:
            channel = await bot.fetch_channel(int(channel_id))
        except Exception as e:
            logger.warning(f"Failed to fetch contact notification channel {channel_id}: {e}")
            return web.json_response({'ok': False, 'error': 'could not fetch channel'}, status=404)

    if not hasattr(channel, 'send'):
        return web.json_response({'ok': False, 'error': 'channel cannot receive messages'}, status=400)

    sender = sender_name or 'unknown sender'
    if sender_email:
        sender = f"{sender} <{sender_email}>"

    message = (
        "## new fridg3.org contact submission\n"
        f"**from:** {sender}\n"
        f"**id:** `{submission_id}`\n"
        f"**dashboard:** {dashboard_url}\n\n"
        f"> {message_preview or 'no preview'}"
    )

    if len(message) > 1900:
        message = message[:1897] + '...'

    try:
        sent_message = await channel.send(message, allowed_mentions=discord.AllowedMentions.none())
    except Exception as e:
        logger.warning(f"Failed to send contact notification {submission_id} to {channel_id}: {e}")
        return web.json_response({'ok': False, 'error': 'failed to send channel message'}, status=500)

    return web.json_response({
        'ok': True,
        'channel_id': str(channel_id),
        'message_id': str(sent_message.id),
    })


async def start_status_server():
    status_app.router.add_get('/status', status_handler)
    status_app.router.add_post('/link-discord', link_discord_handler)
    status_app.router.add_post('/send-account-invite', send_account_invite_handler)
    status_app.router.add_post('/messages/send', send_message_handler)
    status_app.router.add_post('/contact/notify', contact_notify_handler)
    runner = web.AppRunner(status_app)
    await runner.setup()
    site = web.TCPSite(runner, '127.0.0.1', 8765)
    await site.start()
    logger.info('Local status server started on http://127.0.0.1:8765/status')


async def main():
    """Start the bot"""
    token = config['bot']['token']
    if token == "YOUR_DISCORD_BOT_TOKEN_HERE":
        logger.error("Bot token not set in toast.json")
        return

    # Start local status server before running the bot
    await start_status_server()

    # Start monitoring tasks
    config_monitor.start()
    heartbeat.start()
    feed_notifications_monitor.start()
    
    # Register signal handler for graceful shutdown
    def signal_handler(signum, frame):
        logger.info("Received SIGINT (Ctrl+C), shutting down gracefully...")
        # Cancel tasks
        config_monitor.cancel()
        heartbeat.cancel()
        feed_notifications_monitor.cancel()
        # Close the bot
        if bot.is_closed():
            logger.info("Bot already closed")
        else:
            import asyncio
            asyncio.create_task(shutdown_bot())
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start the bot
    try:
        await bot.start(token)
    except discord.errors.LoginFailure:
        logger.error("Invalid bot token provided")

async def shutdown_bot():
    """Gracefully close the bot and disconnect from voice"""
    try:
        global bot_online
        logger.info("Disconnecting from voice channels...")
        for vc in bot.voice_clients:
            if vc.is_playing():
                vc.stop()
            await vc.disconnect()
        bot_online = False
        logger.info("Closing bot connection...")
        await bot.close()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
