#!/usr/bin/env python3
"""
Discord bot for fridg3.org - plays m3u internet streams
"""

import discord
from discord import app_commands
from discord.ext import commands, tasks
import json
import os
import logging
import signal
from aiohttp import web
from pathlib import Path
import re
import shutil
import getpass

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

# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)
bot_online = False

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

async def status_handler(request):
    return web.json_response({
        'online': bot_online and not bot.is_closed(),
        'stream_name': config.get('stream', {}).get('name', 'Unknown Stream')
    })


async def start_status_server():
    status_app.router.add_get('/status', status_handler)
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
    
    # Register signal handler for graceful shutdown
    def signal_handler(signum, frame):
        logger.info("Received SIGINT (Ctrl+C), shutting down gracefully...")
        # Cancel tasks
        config_monitor.cancel()
        heartbeat.cancel()
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
