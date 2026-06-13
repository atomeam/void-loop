# PixelLab MCP Tools - AI Assistant Guide

> Generate pixel art assets directly from your AI coding assistant using the Model Context Protocol (MCP)

You have access to PixelLab's MCP tools for creating game-ready pixel art. This guide explains what tools are available and how to use them effectively.

## ⚠️ IMPORTANT: These are MCP tools, not REST endpoints

- If you see PixelLab tools available (like `create_character`, `animate_character`), use them directly
- If you don't see these tools, tell the user MCP isn't configured
- don't try curl or v2 API
- Tool names may be prefixed (`mcp__pixellab__create_character`) or bare (`create_character`) depending on client
- Download URLs like `/mcp/characters/{id}/download` are the only direct HTTP endpoints

## What is PixelLab MCP?

PixelLab MCP (also called "Vibe Coding") lets you generate pixel art characters, animations, and tilesets while coding. The tools are non-blocking - they return job IDs immediately and process in the background (typically 2-5 minutes).

## Other PixelLab Interfaces

If users mention these, they're using different PixelLab interfaces:

- **Web interfaces**: Character Creator, Map Workshop, Simple Creator (visual tools at pixellab.ai)
- **Editor plugins**: Aseprite extension, Pixelorama integration
- **API v1**: Legacy REST endpoints (deprecated)
- **API v2**: Modern REST API for programmatic usage
  - Documentation: https://api.pixellab.ai/v2/llms.txt
  - You can use these endpoints directly via HTTP requests when writing code
  - Same functionality as MCP but through REST calls
  - Useful for: batch processing, custom integrations, live in-game asset generation
  - Also useful when you need endpoints not available as MCP tools (use at own risk - MCP tools are made for easy AI usage)

Note: Characters and tilesets created via MCP will appear in Character Creator and Map Workshop web interfaces respectively (if using the same account).

## MCP/Vibe Coding Setup

1. Get your API token at https://api.pixellab.ai/mcp
2. Configure your AI assistant (Cursor, Claude Code, VS Code, etc.)
3. Start generating game assets while coding

### MCP Configuration

```json
{
  "mcpServers": {
    "pixellab": {
      "url": "https://api.pixellab.ai/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  }
}
```

## Key Concepts

### Non-Blocking Operations

All creation tools return immediately with job IDs:

- Submit request → Get job ID instantly
- Process runs in background (2-5 minutes)
- Check status with corresponding `get_*` tool
- Download when ready (UUID serves as access key)
- **No authentication for downloads**: Share download links freely
- UUID acts as the key

### Workflow Pattern

```python
# 1. Create (returns immediately)
result = create_character(description='wizard', n_directions=8)
character_id = result.character_id

# 2. Queue animations immediately (no waiting!)
animate_character(character_id, 'walk')
animate_character(character_id, 'idle')

# 3. Check status later
status = get_character(character_id)
```

### Connected Tilesets

Create seamless terrain transitions by chaining tilesets:

```python
# First tileset returns base_tile_ids immediately
t1 = create_topdown_tileset('ocean', 'beach')

# Chain next tileset using base tile ID (no waiting!)
t2 = create_topdown_tileset('beach', 'grass', lower_base_tile_id=t1.beach_base_id)
```

## Available Tools

### Character & Animation Tools

**💡 Tips:**
- Characters are stored permanently and can be reused
- Animations can be queued immediately after character creation
- 4 directions: south, west, east, north
- 8 directions: adds south-east, north-east, north-west, south-west
- Canvas size is total area; character will be ~60% of canvas height

#### `create_character`

Queue character creation. Returns immediately with character ID. Use get_character to check status.

**Examples:**

```python
# Humanoid character (default)
create_character(
  description='brave knight with shining armor',
  n_directions=8,
  size=48,
  proportions='{"type": "preset", "name": "heroic"}'
)

# Quadruped character
create_character(
  description='orange tabby cat',
  body_type='quadruped',
  template='cat',  # bear, cat, dog, horse, lion
  n_directions=8,
  size=48
)
```

**Parameters:**
- `description`: str (optional) [default: PydanticUndefined]
- `name`: Optional (optional) [default: None]
- `body_type`: Literal (optional) [default: humanoid]
  - 'humanoid' for people/robots (default)
  - 'quadruped' for animals (requires template)
- `template`: Optional (optional) [default: None]
  - Required for quadrupeds: bear, cat, dog, horse, lion
- `mode`: Literal (optional) [default: standard]
- `n_directions`: Literal (optional) [default: 8]
  - Use 8 for full rotation, 4 for cardinal directions
- `proportions`: Optional (optional) [default: {"type": "preset", "name": "default"}]
  - Presets: default, chibi, cartoon, stylized, realistic_male, realistic_female, heroic (humanoid only)
- `size`: int (optional) [default: 48]
  - Canvas size in pixels (character ~60% of height)
- `outline`: Optional (optional) [default: single color black outline]
- `shading`: Optional (optional) [default: basic shading]
- `detail`: Optional (optional) [default: medium detail]
- `text_guidance_scale`: float (optional) [default: 8.0]
- `view`: Literal (optional) [default: low top-down]

#### `create_character_state`

Queue a state (variant) of an existing character. The new character keeps the source's identity, body type, and proportions, with the edit applied consistently across all 4 or 8 rotations. Auto-waits up to 30s for the source to complete.

**Examples:**

```python
# Humanoid character (default)
create_character(
  description='brave knight with shining armor',
  n_directions=8,
  size=48,
  proportions='{"type": "preset", "name": "heroic"}'
)

# Quadruped character
create_character(
  description='orange tabby cat',
  body_type='quadruped',
  template='cat',  # bear, cat, dog, horse, lion
  n_directions=8,
  size=48
)
```

**Parameters:**
- `character_id`: str (optional) [default: PydanticUndefined]
- `edit_description`: str (optional) [default: PydanticUndefined]
- `seed`: Optional (optional) [default: None]
- `use_color_palette_from_reference`: bool (optional) [default: False]

#### `animate_character`

Queue animation for a character. Returns immediately with job IDs. ~2-4 min.

**Example:**

```python
animate_character(
  character_id='uuid-from-create',
  template_animation_id='walking',  # Check tool description for full list
  action_description='walking proudly'  # optional customization
)
```

**Parameters:**
- `character_id`: str (optional) [default: PydanticUndefined]
- `template_animation_id`: Optional (optional) [default: None]
- `action_description`: Optional (optional) [default: None]
- `animation_name`: Optional (optional) [default: None]
- `directions`: Optional (optional) [default: None]
- `mode`: Optional (optional) [default: None]
- `frame_count`: int (optional) [default: 8]
- `confirm_cost`: bool (optional) [default: False]

#### `get_character`

Get character details, rotation URLs, animations, and download link. Branches by status: processing (progress+ETA), failed (error+retry), completed (full data).

**Parameters:**
- `character_id`: str (optional) [default: PydanticUndefined]
- `include_preview`: bool (optional) [default: True]

#### `list_characters`

List your characters with status. Returns compact one-line-per-character format. Use get_character(character_id) for full details on any character.

**Parameters:**
- `limit`: int (optional) [default: 10]
- `offset`: int (optional) [default: 0]
- `tags`: str | None (optional) [default: None]

#### `delete_character`

Delete a character and all its associated data. Set confirm=true to proceed.

**Parameters:**
- `character_id`: str (optional) [default: PydanticUndefined]
- `confirm`: bool (optional) [default: False]

### Top-Down Tileset Tools

**💡 Wang Tileset System:**
- Creates 16 tiles covering all corner combinations
- Perfect for seamless terrain transitions
- Use base_tile_ids to chain multiple tilesets
- tile_size: typically 16x16 or 32x32 pixels
- transition_size: 0=sharp, 0.25=medium, 0.5=wide blend

#### `create_topdown_tileset`

Generate a Wang tileset for top-down game maps with corner-based autotiling.

**Example (chained tilesets):**

```python
# Ocean → Beach → Grass → Forest
t1 = create_topdown_tileset('ocean water', 'sandy beach')
t2 = create_topdown_tileset('sandy beach', 'green grass', lower_base_tile_id=t1.beach_base_id)
t3 = create_topdown_tileset('green grass', 'dense forest', lower_base_tile_id=t2.grass_base_id)
```

**Parameters:**
- `lower_description`: str (optional) [default: PydanticUndefined]
- `upper_description`: str (optional) [default: PydanticUndefined]
- `transition_size`: float (optional) [default: 0.0]
  - 0=sharp edge, 0.25=medium blend, 0.5=wide transition
- `transition_description`: Optional (optional) [default: None]
- `tile_size`: Dict (optional) [default: {'width': 16, 'height': 16}]
- `outline`: Optional (optional) [default: None]
- `shading`: Optional (optional) [default: None]
- `detail`: Optional (optional) [default: None]
- `view`: Literal (optional) [default: high top-down]
  - 'high top-down' for RTS, 'low top-down' for RPG
- `tile_strength`: float (optional) [default: 1.0]
- `lower_base_tile_id`: Optional (optional) [default: None]
  - Use base_tile_id from previous tileset for continuity
- `upper_base_tile_id`: Optional (optional) [default: None]
- `tileset_adherence`: float (optional) [default: 100.0]
- `tileset_adherence_freedom`: float (optional) [default: 500.0]
- `text_guidance_scale`: float (optional) [default: 8.0]

#### `get_topdown_tileset`

Get a topdown Wang tileset by ID. Returns status, download links, base tile IDs for chaining, and an example map image.

**Parameters:**
- `tileset_id`: str (optional) [default: PydanticUndefined]

#### `list_topdown_tilesets`

List your top-down Wang tilesets. One line per tileset with status. Use get_topdown_tileset(tileset_id) for full details.

**Parameters:**
- `limit`: int (optional) [default: 10]
- `offset`: int (optional) [default: 0]

#### `delete_topdown_tileset`

Delete a topdown tileset. Set confirm=true to proceed.

**Parameters:**
- `tileset_id`: str (optional) [default: PydanticUndefined]
- `confirm`: bool (optional) [default: False]

### Side-Scroller Tileset Tools

#### `create_sidescroller_tileset`

Generate a tileset for side-scroller platformer games.

**Parameters:**
- `description`: str (optional) [default: PydanticUndefined]
- `tile_size`: Dict (optional) [default: {'width': 16, 'height': 16}]
- `outline`: Optional (optional) [default: None]
- `shading`: Optional (optional) [default: None]
- `detail`: Optional (optional) [default: None]
- `text_guidance_scale`: float (optional) [default: 8.0]

#### `get_sidescroller_tileset`

Get a side-scroller tileset by ID.

**Parameters:**
- `tileset_id`: str (optional) [default: PydasticUndefined]

#### `list_sidescroller_tilesets`

List your side-scroller tilesets.

**Parameters:**
- `limit`: int (optional) [default: 10]
- `offset`: int (optional) [default: 0]

#### `delete_sidescroller_tileset`

Delete a side-scroller tileset. Set confirm=true to proceed.

**Parameters:**
- `tileset_id`: str (optional) [default: PydanticUndefined]
- `confirm`: bool (optional) [default: False]

### Isometric Tileset Tools

#### `create_isometric_tileset`

Generate an isometric tileset.

**Parameters:**
- `description`: str (optional) [default: PydanticUndefined]
- `tile_size`: Dict (optional) [default: {'width': 32, 'height': 32}]
- `outline`: Optional (optional) [default: None]
- `shading`: Optional (optional) [default: None]
- `detail`: Optional (optional) [default: None]
- `text_guidance_scale`: float (optional) [default: 8.0]

#### `get_isometric_tileset`

Get an isometric tileset by ID.

**Parameters:**
- `tileset_id`: str (optional) [default: PydanticUndefined]

#### `list_isometric_tilesets`

List your isometric tilesets.

**Parameters:**
- `limit`: int (optional) [default: 10]
- `offset`: int (optional) [default: 0]

#### `delete_isometric_tileset`

Delete an isometric tileset. Set confirm=true to proceed.

**Parameters:**
- `tileset_id`: str (optional) [default: PydanticUndefined]
- `confirm`: bool (optional) [default: False]

### Map Object Tools

#### `create_map_object`

Create a map object (item, prop, obstacle, etc.).

**Parameters:**
- `description`: str (optional) [default: PydanticUndefined]
- `size`: Dict (optional) [default: {'width': 32, 'height': 32}]
- `outline`: Optional (optional) [default: None]
- `shading`: Optional (optional) [default: None]
- `detail`: Optional (optional) [default: None]
- `text_guidance_scale`: float (optional) [default: 8.0]

#### `get_map_object`

Get a map object by ID.

**Parameters:**
- `object_id`: str (optional) [default: PydanticUndefined]

#### `list_map_objects`

List your map objects.

**Parameters:**
- `limit`: int (optional) [default: 10]
- `offset`: int (optional) [default: 0]

#### `delete_map_object`

Delete a map object. Set confirm=true to proceed.

**Parameters:**
- `object_id`: str (optional) [default: PydanticUndefined]
- `confirm`: bool (optional) [default: False]

---

**Source:** https://api.pixellab.ai/mcp/docs
