#!/usr/bin/env python3
"""
Discord bot for fridg3.org - plays m3u internet streams
"""

import discord
from discord.ext import commands, tasks
import json
import os
import logging
import time
import signal
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
    """Update bot status in config file (online/offline)"""
    global config
    try:
        config['bot']['status'] = status
        with open(CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=4)
        logger.info(f"Updated bot status to: {status}")
    except Exception as e:
        logger.error(f"Failed to update bot status in config: {e}")

def log_status_update(message: str):
    """Log a status update to toast-updates.json"""
    try:
        updates_path = CONFIG_PATH.parent / 'toast-updates.json'
        updates = []
        
        # Load existing updates
        if updates_path.exists():
            try:
                with open(updates_path, 'r') as f:
                    updates = json.load(f)
                    if not isinstance(updates, list):
                        updates = []
            except:
                updates = []
        
        # Add new update at the beginning (most recent)
        from datetime import datetime
        new_update = {
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': message
        }
        updates.insert(0, new_update)
        
        # Keep only the last 15 updates
        updates = updates[:15]
        
        # Write back to file
        with open(updates_path, 'w') as f:
            json.dump(updates, f, indent=4)
        logger.info(f"Logged status update: {message}")
    except Exception as e:
        logger.error(f"Failed to log status update: {e}")

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

# Track config reload state
last_config_reload_time = None
signal_file_path = CONFIG_PATH.parent / '.stream-update-signal'

# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    """Called when the bot connects to Discord"""
    logger.info(f"Bot logged in as {bot.user}")
    logger.info(f"Bot ID: {bot.user.id}")
    
    # Update status to online
    update_bot_status("online")
    log_status_update("Bot connected to Discord")
    
    # Update Discord presence with stream name
    await update_discord_presence()
    
    # Try to join the voice channel and start playing
    await auto_play_stream()

@bot.event
async def on_disconnect():
    """Called when the bot disconnects from Discord"""
    logger.info("Bot disconnected from Discord")
    update_bot_status("offline")
    log_status_update("Bot disconnected from Discord")

@tasks.loop(seconds=1)  # Check every second for immediate stream restart signal
async def config_monitor():
    """Monitor for stream update signal and reload config + restart playback immediately"""
    global config, last_config_reload_time
    try:
        if signal_file_path.exists():
            logger.info("Stream update signal detected, reloading config and restarting stream...")
            # Reload config from file
            try:
                old_stream_name = config.get('stream', {}).get('name', 'Unknown')
                config = load_config()
                new_stream_name = config.get('stream', {}).get('name', 'Unknown')
                last_config_reload_time = time.time()
            except Exception as e:
                logger.error(f"Failed to reload config: {e}")
                return
            
            # Stop current playback
            for vc in bot.voice_clients:
                if vc.is_playing():
                    vc.stop()
                await vc.disconnect()
            
            # Log stream change
            log_status_update(f"Station changed from {old_stream_name} to {new_stream_name}")
            
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

@bot.command()
async def play(ctx):
    """Manually trigger stream playback"""
    await auto_play_stream()
    await ctx.send(f"🎵 Now playing: {config['stream']['name']}")

@bot.command()
async def stop(ctx):
    """Stop playback and disconnect from voice"""
    for vc in bot.voice_clients:
        await vc.disconnect()
    await ctx.send("⏹️ Stopped playback")

@bot.command()
async def status(ctx):
    """Show bot status"""
    voice_clients = bot.voice_clients
    if voice_clients:
        vc = voice_clients[0]
        is_playing = vc.is_playing()
        status_str = f"▶️ Playing {config['stream']['name']}" if is_playing else "⏸️ Connected but not playing"
    else:
        status_str = "⭕ Disconnected"
    
    await ctx.send(f"Bot Status: {status_str}")

async def main():
    """Start the bot"""
    token = config['bot']['token']
    if token == "YOUR_DISCORD_BOT_TOKEN_HERE":
        logger.error("Bot token not set in toast.json")
        return
    
    # Set status to offline at startup (will be set to online on_ready)
    update_bot_status("offline")
    
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
        logger.info("Disconnecting from voice channels...")
        for vc in bot.voice_clients:
            if vc.is_playing():
                vc.stop()
            await vc.disconnect()
        logger.info("Updating status to offline...")
        update_bot_status("offline")
        logger.info("Closing bot connection...")
        await bot.close()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
