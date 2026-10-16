---
name: mcd-bite-battle
description: Run or explain the 麦麦点餐擂台 single-player meal strategy challenge, compare identical McDonald’s meal bags with the project's official MCP adapter, or reproduce its verified live demo. Use with this complete project checkout.
---

# 麦麦点餐擂台

Help the user play a one-person challenge: build a legal purchase plan for a fixed bag of food, lock it, then reveal the preselected strategy opponent and compare prices.

Resolve the project root as two parent directories above this skill folder. Read that root's `README.md` for launching and `MCP_INTEGRATION.md` before changing live queries. Keep the complete checkout; this entrypoint depends on the project's implementation.

## Choose the supported mode

- For interactive play, run `node --env-file-if-exists=.env server.mjs` from the root and offer the printed local URL. Reuse an already-running instance. Training requires no token.
- For a repeatable real-price demonstration, run `node --env-file-if-exists=.env scripts/demo-live.mjs`. It prepares the chicken challenge and compares “随心配 + 中薯” against the sealed opponent. Report the returned outcome even if the player no longer wins.
- For integration verification, run `node --env-file-if-exists=.env scripts/verify-live.mjs`. It checks three fixed default meal cases and writes local raw evidence under ignored `work/live/`.

If live setup is missing, direct the user to edit `.env` locally using `.env.example`; do not ask them to send a token. Keep training available. The example MCP client config uses a placeholder and needs a host that supports environment substitution; it is not loaded by the Node app.

## What makes a valid comparison

Use the project's `LiveArena` and rule engine for results. Real mode supports searched open stores, pickup, no account coupons and default modifications. Legacy CLI defaults to store `1450713`; do not assume it is currently open. Expand every offer into canonical child food codes, quantities and full default modification signatures. A smaller cup, fewer fries, extra food, or different sugar option is a different bag.

Never use a size-specific drink leaf directly as a top-level purchase SKU unless the current official menu declares it orderable. Resolve it through a menu parent with an explicit matching child code. Validate that the official price response includes every requested top-level product and quantity: a successful response can silently omit an unsupported SKU.

Only declare a real win after both complete bags pass comparison and official integer-cent quotes. A missing receipt, unavailable item, changed menu or failed quote means no verified outcome. Local training amounts and coupons must be called examples. Historical cases in `docs/VERIFICATION.md` cannot substitute for live quotes.

## Explain the game honestly

The default opponent is a deterministic bounded strategy. Local mode additionally supports DeepSeek through `DEEPSEEK_API_KEY` and optional `DEEPSEEK_MODEL`; read `docs/MODEL_INTEGRATION.md` before working on model tool calls. Never expose the server environment key to the browser or request keys in chat. Visitors may enter their own key in the explicit page form; keep it in page/request memory only, never persist or share it. The live beginner compares whole-set and all-single plans, while the player can discover a mixed plan. Its original plan is stored server-side before the player acts. A win means beating this disclosed strategy; do not call it a global minimum or a guaranteed checkout price.

When the user asks why a plan fails, explain concrete missing or extra items before discussing price. When explaining a successful move, name the changed purchase grouping and the exact matched contents. Preserve truthful ties and losses.

This skill's operations query and quote only. Do not add coupon binding, ordering, payment, account mutation, automatic public posting or competition signup to a play request. For code edits, run the relevant existing tests; the base checks are `node --test tests/*.test.mjs` and `node scripts/check.mjs`.

## Play paths

On mobile, the bottom bag button opens the cart drawer for quantities and coupons. The default menu shows relevant offers; the expand control reveals all offers. Invite a model using the visitor API form from the opponent card (see docs/V03_RELEASE.md): the server prepares and seals its plan before player selection. It has at most three quote attempts and must submit a previously verified exact plan; failures must not silently switch opponents.

Use the share control to preserve the training food bag, budget and data version. A completed training plan can travel as a benchmark, which the receiver revalidates before comparing. Shared links use strategy opponents and never carry model keys, model answers, or live historical prices. Real invitations require the receiver’s own local MCP setup and fresh quotes. Preserve the hosting audience unless the user explicitly asks to change it.
