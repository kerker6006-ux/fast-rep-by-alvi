WITH duplicate_incoming AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY fb_message_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.messages
  WHERE fb_message_id IS NOT NULL
    AND direction = 'incoming'
)
DELETE FROM public.messages m
USING duplicate_incoming d
WHERE m.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS messages_unique_incoming_fb_mid_idx
ON public.messages (fb_message_id)
WHERE fb_message_id IS NOT NULL
  AND direction = 'incoming';