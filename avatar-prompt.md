# Avatar Generation Prompt

## Per-person prompt (upload one photo at a time)

> Create a pixel art avatar based on the person in this photo. 32x32 pixels per frame, 4 frames arranged horizontally for an idle animation (subtle vertical bobbing: frame 1 base position, frame 2 one pixel up, frame 3 base position, frame 4 one pixel down). Chibi-style with a round head and small body, capturing the person's most distinctive features (hair style, hair color, skin tone, facial hair if any, glasses if any). Use a clean limited color palette, max 12 colors. Style similar to Stardew Valley or Earthbound characters. Transparent background, no shadow. Output at 4x scale (128x128 per frame, 512x128 total) so pixels are clearly visible. Keep the character cute and recognizable but simple — prioritize silhouette readability over detail.

## Consistency follow-up (after the first good sprite)

Add this to the beginning of subsequent prompts, attaching the approved sprite as reference:

> Match the exact same pixel art style, proportions, and color palette approach as the attached reference sprite.
