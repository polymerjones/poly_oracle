# SPC Tutorial VO — Mapping Table (read-only audit)

**Generated:** 2026-06-18 · **Scope:** `TUTORIAL_PHASES` (script.js line 11232) vs descriptive `vo/SPC_*.mp3` files on disk.
**Nothing was renamed or edited.** This is for Paul to review before any wiring decision.

---

## How the resolver actually works (critical context)

```js
// script.js:10690
function spcVoSrc(key) {
  return SPC_VO_AVAILABLE.has(key) ? `vo/SPC_${key}.mp3` : null;
}
function spcVO(key, text, frameHint) { ... const src = spcVoSrc(key); ... }
```

- `spcVO(key, caption, pose)` plays `vo/SPC_<key>.mp3` **only if `key` is an exact member of the `SPC_VO_AVAILABLE` Set** (script.js:6400). There is **no** compound-key splitting.
- If the key isn't in the Set → `null` → **caption text plays alone (text-only by design)**.
- If the key **is** in the Set but the file isn't on disk → the audio element gets a path that **404s at runtime**.

### Three runtime states in the tables below
- 🟢 **PLAYS** — key in Set **and** file `SPC_<key>.mp3` exists on disk.
- 🔴 **404** — key in Set but `SPC_<key>.mp3` is **missing** (resolver hands back a dead path).
- ⬜ **TEXT-ONLY** — key not in Set; caption shows, no audio attempted (intentional today).

> **Headline:** Of ~60 tutorial lines, **only two actually play audio today** — `08-09` and `freeze_toggle`. Everything else is either text-only-by-design or points at a missing numbered file. The descriptive recordings on disk are **not wired to any of these keys**.

---

## Mapping table — phase by phase, in fire order

Columns: **Order** · **Key** (code) · **Runtime** · **Caption text passed in code** · **Best-match descriptive file on disk** · **Confidence**

### Phase 1 — `intro`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `01` | 🔴 404 | Hi there Cadet, welcome to the Polyverse simulator. | `SPC_01_splitA_hi_there_cadet_welcome_to_the_polyverse_simulator.mp3` | **exact** |
| 2 | `02` | ⬜ text | Let me show you the ropes before the real battle. | `SPC_01_splitB.mp3` (no words in name) | unclear |
| 3 | `03` | ⬜ text | First — the perimeter timer. | `SPC_01_splitC.mp3` (no words in name) | unclear |
| 4 | `04a` | ⬜ text | That line around the screen edges | `SPC_01_splitD.mp3` (no words in name) | unclear |
| 5 | `04b` | ⬜ text | shows how long you have to clear the field. | — (split D/E candidates) | unclear |

> The original 18s `old_SPC_01.mp3` was chopped into `splitA–E`. `splitA` clearly = line `01`; `splitE` is named `…_tap_it_now` which matches **line 06** ("Tap it now"), *not* an intro line — so the splits do **not** map 1:1 onto captions 01–04b. **splitB/C/D need a listen to assign.**

### Phase 2 — `timer`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `05` | ⬜ text | Every so often a timer power-up appears. | — none on disk | **no match** |
| 2 | `06` | ⬜ text | Grab it to buy time. Tap it now. | `SPC_01_splitE_tap_it_now.mp3` (partial — "tap it now" only) | likely-partial |
| 3 | `07` | 🔴 404 | Great! From here the timer's paused while you train. | `SPC_timer-praise_great_timer_is_paused.mp3` | likely |

### Phase 3 — `laser`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `08-09` | 🟢 **PLAYS** | These are the stroids — our job is to clear them from the Polyverse. | `SPC_08-09.mp3` *(already wired)* — alt take: `SPC_08_these_are_the_stroids.mp3` | **exact** |
| 2 | `10-11` | ⬜ text | Tap to fire your laser and blast the stroid and all its pieces. | `SPC_08b_blast_the_stroids.mp3` (partial — "blast the stroids") | likely-partial |
| 3 | `12` | 🔴 404 | Fantastic, Cadet. You'll show these stroids who's boss. | `SPC_08c_praise.mp3` (generic praise, positional) | likely |

### Phase 4 — `plasma`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `13-14` | 🔴 404 | Next up — the plasma net. Tap, drag and hold to set it. | `SPC_13_tap_drag_and_hold_to_set_it.mp3` | likely |
| 2 | `15-16` | 🔴 404 | When stroids glow they're targeted. Release to fire. | `SPC_when_stroids_glow_theyre_targeted.mp3` + `SPC_13b_release_to_fire.mp3` (two halves) | likely |
| 3 | `17` | 🔴 404 | NICE! Great work, Cadet. | `SPC_praise_great_work.mp3` | likely |
| 4 | `18` | 🔴 404 | Now let the plasma recharge and do it again! | `SPC_13_now_let_the_plasma_recharge_and_do_it_again.mp3` | **exact** |
| 5 | `19` | 🔴 404 | Plasma is recharged. | `SPC_plasma_is_recharged.mp3` | **exact** |
| 6 | `17b` | 🔴 404 | NICE! Great work, Cadet. | `SPC_praise_nice_great_work_cadet.mp3` (alt of `17`) | likely |

### Phase 5 — `ufo`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `23` | 🔴 404 | UFO spotted, Cadet! | `SPC_UFO_spotted_cadet.mp3` | **exact** |
| 2 | `24` | 🔴 404 | Shoot it twice to take it out! | `SPC_UFO-shoot_it_twice.mp3` | likely |
| 3 | `25` | 🔴 404 | Direct hit! Do it again! | `SPC_direct_hit.mp3` (partial — "direct hit") | likely |
| 4 | `26` | 🔴 404 | Wow, there you go. | `SPC_UFO_praise_wow_there_you_go.mp3` | **exact** |
| 5 | `27` | 🔴 404 | Destroying a UFO instantly recharges your plasma. | `SPC_UFO-destroying_a_ufo_instantly_recharges.mp3` | likely |
| 6 | `28-30` | 🔴 404 | So net the stroids when a UFO shows up, pop the UFO, and instantly get another net shot. Let's try it. | `SPC_ufo-so_a_good_move_is_to_net_the_stroids_when_a_ufo.mp3` + `SPC_UFO-pop_the_ufo_and_instantly_get_another_net_shot.mp3` (two halves) | likely |
| 7 | `31` | 🔴 404 | Use your plasma net on those stroids. | `SPC_use_your_plasma_net_on_those_stroids.mp3` | **exact** |
| 8 | `31b` | ⬜ text | Good shot — but try the plasma net first, then the UFO. Let's run it again. | — (closest: `SPC_try_it_again.mp3`, weak) | **no good match** |
| 9 | `20` | 🔴 404 | Make sure the stroids are targeted first. | `SPC_make_sure_the_stroids_are_targeted_first.mp3` | **exact** |
| 10 | `22` | 🔴 404 | Take your time — get them highlighted before you release. | `SPC_take_your_time_get_them_highlighted.mp3` | likely |
| 11 | `32` | 🔴 404 | Now destroy the UFO quickly! | `SPC_UFO-now_destroy_the_ufo_quickly.mp3` | **exact** |
| 12 | `33` | 🔴 404 | Plasma recharged — make another net! | `SPC_plasma_recharged_make_another_net.mp3` | **exact** |
| 13 | `34` | 🔴 404 | Nice work, Cadet. You learn fast. | `SPC_UFO-net-combo-praise_nice_work_cadet_you_learn_fast.mp3` | **exact** |

### Phase 6 — `toss`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `35-36` | ⬜ text | Next — the stroid toss. Tap and hold a stroid to grab it. | `SPC_tossA_next_i_need_to_show_you_the_stroid_toss_attack.mp3` + `SPC_tossB_tap_and_hold_a_stroid_to_grab_it.mp3` (two halves) | likely |
| 2 | `38` | 🔴 404 | You have to swipe or flick to toss it. | `SPC_stroid-fail_You_have_to_swipe_or_flick_to_toss_it.mp3` | **exact** |
| 3 | `39` | 🔴 404 | Give it a good flick, Cadet — put some effort in! | `SPC_toss_give_it_a_good_flick_cadet.mp3` (partial — drops "put some effort in") | likely |
| 4 | `40` | 🔴 404 | Very good, Cadet. | `SPC_toss-praise_very_good_cadet.mp3` | **exact** |
| 5 | `41` | 🔴 404 | Things will get hectic out there. | `SPC_landmine1_things_will_get_hectic_out_there.mp3` *(filename mislabeled "landmine1")* | **exact** |

### Phase 7 — `landmine`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `42-43` | 🔴 404 | When you see a bomb, tap it to arm it — you can also grab and toss bombs like stroids. | `SPC_landmine2_see_a_bomb_tap_to_arm.mp3` + `SPC_bombs_you_can_also_grab_and_toss_bombs.mp3` (two halves) | likely |
| 2 | `44-45` | 🔴 404 | The bomb explodes soon, but to detonate it yourself, just tap it again. | `SPC_landmine3_the_bomb_will_explode_soon.mp3` + `SPC_bomb_to_detonate_it_yourself_tap_it_again.mp3` (two halves) | likely |
| 3 | `46` | 🔴 404 | Okay Cadet, let's detonate the bomb ourselves. | `SPC_landmine_lets_detonate_the_bomb_ourselves.mp3` | **exact** |
| 4 | `47` | 🔴 404 | Tap the armed bomb to detonate it. | `SPC_landmine_tap_the_armed_bomb_to_detonate_it.mp3` | **exact** |
| 5 | `48` | 🔴 404 | Boom. That was fantastic, Cadet. | `SPC_landmine-praise_Boom_that_was_fantastic.mp3` | **exact** |
| 6 | `49` | 🔴 404 | Bombs can save you from some hairy situations. | `SPC_bombs_bombs_can_save_you_from_some_hairy_situations.mp3` | **exact** |

### Phase 8 — `bombInventory`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `50-51` | ⬜ text | Sometimes a bomb powerup appears — tap it to add it to your HUD. | `SPC_bomb_sometimes_a_bomb_powerup_will_appear.mp3` + `SPC_bomb_tap_it_to_add_it_to_your_hud.mp3` (two halves) | **exact** |
| 2 | `52-54` | ⬜ text | Tap the bomb icon in your HUD, then tap the screen to place it. Arm it and tap to detonate. | `SPC_bomb_tap_the_bomb_icon_in_your_hud.mp3` + `SPC_bomb_now_tap_the_screen_where_you_want_to_place_it.mp3` + `SPC_bomb_arm_it_then_tap_it_again_to_detonate.mp3` (three halves) | **exact** |

### Phase 9 — `quadshot`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `55` | ⬜ text | Throughout the missions, power-ups appear. | `SPC_powerups_throughout_your_missions_powerups_will_appear.mp3` | likely |
| 2 | `56` | ⬜ text | That's the quad shot power-up. Pick it up! | `SPC_quad_thats_the_quad_shot.mp3` (partial — drops "pick it up") | likely |
| 3 | `57` | 🔴 404 | Blast those stroids with the quad shot! | — (closest `SPC_08b_blast_the_stroids.mp3` is the laser line) | **no good match** |
| 4 | `58` | 🔴 404 | Keep firing, Cadet! | `SPC_quad_keep_firing_only_play_once.mp3` | likely |

### Phase 10 — `freeze`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `59-60` | ⬜ text | Pick up the freeze powerup and tap the freeze button on your HUD to activate it. | `SPC_freeze_pickup_the_freeze_powerup.mp3` + `SPC_freeze_to_activate_the_freeze_powerup.mp3` (two halves) | likely |
| 2 | `61` | 🔴 404 | Objects are frozen for a short time. Blast 'em! | `SPC_freeze_objects_are_frozen_for_a_short_time.mp3` | likely |
| 3 | `freeze_toggle` | 🟢 **PLAYS** | Freeze can be enabled and disabled by tapping the freeze icon on your HUD. | `SPC_freeze_toggle.mp3` *(already wired)* | **exact** |
| 4 | `62` | 🔴 404 | Frozen stroids can be tossed too. Grab one and toss it. | `SPC_freeze_frozen_stroids_can_be_tossed_too.mp3` + `SPC_freeze_grab_one_and_toss_it.mp3` (two halves) | **exact** |
| 5 | `63` | 🔴 404 | Good shooting — but try grabbing and tossing a frozen stroid. | `SPC_freeze_but_try_grabbing_and_tossing_a_frozen_stroid.mp3` (partial — drops "good shooting") | likely |
| 6 | `63b` | 🔴 404 | Freeze expired — grab another one and try the toss. | `SPC_freeze_freeze_expired.mp3` + `SPC_freeze_grab_another_one_and_try_the_toss.mp3` (two halves) | **exact** |
| 7 | `64` | 🔴 404 | Very cool, Cadet. | `SPC_freeze-praise_very_cool_cadet.mp3` | **exact** |

### Phase 11 — `missile`
| # | Key | Runtime | Caption | Best descriptive file | Conf |
|---|-----|---------|---------|----------------------|------|
| 1 | `65` | 🔴 404 | Pick up the missiles, Cadet. | `SPC_missile_pick_up_the_missiles_cadet.mp3` | **exact** |
| 2 | `66` | 🔴 404 | Tap the missile weapon in the HUD to arm a missile. | `SPC_missile2_tap_the_missile_in_hud_to_arm.mp3` | likely |
| 3 | `67` | 🔴 404 | Now tap to set a target and watch the destruction. | `SPC_missile_now_tap_a_target_and_watch_the_destruction.mp3` | **exact** |
| 4 | `68` | 🔴 404 | Excellent work, Cadet. | `SPC_freeze-toss-praise_excellent_work_cadet.mp3` *(filename mislabeled "freeze-toss")* | likely |
| 5 | `69` | 🔴 404 | This concludes our training for today. | `SPC_training-end_this_concludes_our_training_for_today.mp3` | **exact** |
| 6 | `70` | 🔴 404 | Go practice if you like — the Polyverse awaits. | `SPC_training-end2_go_practice_if_you_like.mp3` (partial — drops "Polyverse awaits") | likely |

---

## A. Orphan files on disk (no clean caption match)

These descriptive `.mp3`s don't line up with any current `TUTORIAL_PHASES` caption — alternate takes, content split differently than the captions, or material for a tutorial beat that isn't scripted:

| File | Note |
|------|------|
| `SPC_01_splitB.mp3` | intro split, no words in name — needs listen (likely line 02/03) |
| `SPC_01_splitC.mp3` / `SPC_01_splitC.wav` | intro split, no words — needs listen (`.wav` is the 2.4 MB source dupe) |
| `SPC_01_splitD.mp3` | intro split, no words — needs listen |
| `SPC_tossC_now_toss_and_release_to_toss_it_at_other_stroids.mp3` | toss-release instruction; current `35-36` caption only covers grab, not release |
| `SPC_08_these_are_the_stroids.mp3` | alternate take of `08-09` (which already plays via `SPC_08-09.mp3`) |
| `SPC_praise.mp3` | generic 2.5s praise, no specific caption (the ex-`praisemp3` we renamed) |
| `SPC_praise_nice_great_work_cadet.mp3` | candidate for `17b` (listed above) — extra if `17b` uses `praise_great_work` |
| `SPC_try_it_again.mp3` | generic retry line; weak candidate for `31b` |
| `old_SPC_01.mp3` | the superseded 18s original (kept as backup per earlier decision) |

> Also note: several files carry **misleading name prefixes** vs their content — `SPC_landmine1_things_will_get_hectic…` is actually toss-phase line `41`; `SPC_freeze-toss-praise_excellent_work_cadet` is actually missile-phase line `68`. Content matches, label doesn't.

## B. Captions with NO usable file (need recording or a sourced split)

| Key | Caption | Status |
|-----|---------|--------|
| `05` | Every so often a timer power-up appears. | **no file** — record |
| `31b` | Good shot — but try the plasma net first, then the UFO. Let's run it again. | **no file** — record |
| `57` | Blast those stroids with the quad shot! | **no file** — record (don't reuse the laser "blast the stroids" take) |
| `02` / `03` / `04a` / `04b` | intro lines | **unconfirmed** — may live inside `SPC_01_splitB/C/D`; confirm by listening before recording |
| `06` | Grab it to buy time. Tap it now. | **partial** — only "tap it now" exists (`splitE`); the "buy time" half is unaccounted |
| `10-11` | Tap to fire your laser… | **partial** — only "blast the stroids" (`08b`); the "tap to fire your laser" half is unaccounted |

## C. Secondary discrepancy — `SPC_VO_AVAILABLE` keys never called

The Set declares keys that **no `spcVO()` call uses** (often because the code passes a compound key the Set doesn't contain). These resolve to nothing useful and should be reconciled during wiring:

- Compound-vs-split mismatch: code calls `35-36`,`50-51`,`52-54`,`55`,`56`,`59-60` (text-only) while the Set holds the **split** keys `35,36,50,51,52,53,54,59,60` — never reached.
- Set-only keys with no caller at all: `21`, `37`, `15-16_release`, `28-30_part2`, `54_alt`, `55-56`, `62_part1`, `63b_part1`, `63b_part2`.

---

## Bottom line for the wiring decision

1. **The tutorial VO is effectively unwired today** — only `08-09` and `freeze_toggle` play; ~50 lines are 🔴 404 or ⬜ text-only.
2. The descriptive recordings cover **most** captions (many **exact**, several as **2–3 file "halves"** of one caption), but they're keyed by sentence, not by the `SPC_NN` numbers the code wants.
3. **Decision still stands (A vs B):** rename descriptive → numbered keys, **or** re-point `SPC_VO_AVAILABLE` + resolver at descriptive names. Note that many single captions map to **multiple** files, and several code keys are **compound** (`52-54`) — so neither direction is a pure 1:1 rename; the resolver/queue may need to accept an **array of files per caption**.
4. **Must record:** `05`, `31b`, `57`; **confirm by ear:** intro `02/03/04a/04b/06` and the partial `10-11`.
5. The CLAUDE.md "verified 1:1 on 2026-06-17" note is **stale** — correct it once wiring lands.
