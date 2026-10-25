# SPC Tutorial VO — Concat & Wiring Plan (Strategy 1, descriptive names)

**Generated:** 2026-06-18 · **Status:** READ-ONLY PLAN. No ffmpeg run, no renames, no `script.js` edits.
**Decision locked:** Strategy 1 (pre-merge half-takes into one clip per caption; keep `pumpSpc` 1:1 and untouched) + **descriptive output filenames** (self-documenting, not opaque `SPC_NN`).

---

## 0. The one code change this requires (resolver: Set → Map)

Going descriptive means the resolver can no longer derive the filename as `SPC_${key}.mp3`. So `SPC_VO_AVAILABLE` (a `Set`, script.js:6400) becomes a **`Map` of key → filename**, and the resolver's one line changes:

```js
// BEFORE (script.js:10690)
function spcVoSrc(key) {
  return SPC_VO_AVAILABLE.has(key) ? `vo/SPC_${key}.mp3` : null;
}

// AFTER
function spcVoSrc(key) {
  const f = SPC_VO_FILES.get(key);
  return f ? `vo/${f}` : null;
}
```

**Blast radius is identical to "reconcile the Set"** — resolver only. `pumpSpc`, the queue, the iOS race fixes: all untouched. The `spcVO("15-16", …)` call sites stay exactly as they are; only the lookup table changes shape.

> Note (correcting the earlier framing): this is slightly more than "reconcile the Set" — it's "replace the Set literal with a Map literal + change one resolver line." Same risk profile, same file region.

---

## 1. CONCAT operations (10) — merge half-takes into one clip per caption

`ffmpeg` concat, in the listed order, → one descriptive output file. **No silence padding decisions here** — these were recorded as back-to-back takes of a single spoken line.

| Key | Caption | Sources (in play order) | → Output filename |
|-----|---------|-------------------------|-------------------|
| `15-16` | When stroids glow they're targeted. Release to fire. | `SPC_when_stroids_glow_theyre_targeted.mp3` → `SPC_13b_release_to_fire.mp3` | `SPC_15-16_stroids_glow_release_to_fire.mp3` |
| `28-30` | So net the stroids when a UFO shows up, pop the UFO, and instantly get another net shot. | `SPC_ufo-so_a_good_move_is_to_net_the_stroids_when_a_ufo.mp3` → `SPC_UFO-pop_the_ufo_and_instantly_get_another_net_shot.mp3` | `SPC_28-30_net_stroids_pop_ufo_combo.mp3` |
| `35-36` | Next — the stroid toss. Tap and hold a stroid to grab it. | `SPC_tossA_next_i_need_to_show_you_the_stroid_toss_attack.mp3` → `SPC_tossB_tap_and_hold_a_stroid_to_grab_it.mp3` | `SPC_35-36_stroid_toss_tap_and_hold.mp3` |
| `42-43` | When you see a bomb, tap it to arm it — you can also grab and toss bombs like stroids. | `SPC_landmine2_see_a_bomb_tap_to_arm.mp3` → `SPC_bombs_you_can_also_grab_and_toss_bombs.mp3` | `SPC_42-43_bomb_arm_grab_toss.mp3` |
| `44-45` | The bomb explodes soon, but to detonate it yourself, just tap it again. | `SPC_landmine3_the_bomb_will_explode_soon.mp3` → `SPC_bomb_to_detonate_it_yourself_tap_it_again.mp3` | `SPC_44-45_bomb_explodes_detonate_yourself.mp3` |
| `50-51` | Sometimes a bomb powerup appears — tap it to add it to your HUD. | `SPC_bomb_sometimes_a_bomb_powerup_will_appear.mp3` → `SPC_bomb_tap_it_to_add_it_to_your_hud.mp3` | `SPC_50-51_bomb_powerup_add_to_hud.mp3` |
| `52-54` | Tap the bomb icon in your HUD, then tap the screen to place it. Arm it and tap to detonate. | `SPC_bomb_tap_the_bomb_icon_in_your_hud.mp3` → `SPC_bomb_now_tap_the_screen_where_you_want_to_place_it.mp3` → `SPC_bomb_arm_it_then_tap_it_again_to_detonate.mp3` | `SPC_52-54_bomb_icon_place_arm_detonate.mp3` |
| `59-60` | Pick up the freeze powerup and tap the freeze button on your HUD to activate it. | `SPC_freeze_pickup_the_freeze_powerup.mp3` → `SPC_freeze_to_activate_the_freeze_powerup.mp3` | `SPC_59-60_freeze_pickup_activate.mp3` |
| `62` | Frozen stroids can be tossed too. Grab one and toss it. | `SPC_freeze_frozen_stroids_can_be_tossed_too.mp3` → `SPC_freeze_grab_one_and_toss_it.mp3` | `SPC_62_frozen_stroids_grab_toss.mp3` |
| `63b` | Freeze expired — grab another one and try the toss. | `SPC_freeze_freeze_expired.mp3` → `SPC_freeze_grab_another_one_and_try_the_toss.mp3` | `SPC_63b_freeze_expired_grab_another.mp3` |

**Concat order confidence:** for all 10, the source filenames are descriptive enough that play order is unambiguous and matches the caption's word order. None are order-ambiguous (see §4 for the genuinely ambiguous items, which are elsewhere). One playback-QA listen after merging is still wise.

---

## 2. Single-file operations (rename-only, no concat)

One existing take → rename to a descriptive, key-prefixed name. (`freeze_toggle` and `grab_small` already play and already have clean names — left as-is.)

| Key | Caption | Source file | → Final filename |
|-----|---------|-------------|------------------|
| `01` | Hi there Cadet, welcome to the Polyverse simulator. | `SPC_01_splitA_hi_there_cadet_welcome_to_the_polyverse_simulator.mp3` | `SPC_01_welcome_to_polyverse.mp3` |
| `07` | Great! From here the timer's paused while you train. | `SPC_timer-praise_great_timer_is_paused.mp3` | `SPC_07_timer_paused.mp3` |
| `08-09` | These are the stroids — our job is to clear them from the Polyverse. | `SPC_08-09.mp3` *(or alt `SPC_08_these_are_the_stroids.mp3` — see §4)* | `SPC_08-09_these_are_the_stroids.mp3` |
| `12` | Fantastic, Cadet. You'll show these stroids who's boss. | `SPC_08c_praise.mp3` | `SPC_12_show_stroids_whos_boss.mp3` |
| `13-14` | Next up — the plasma net. Tap, drag and hold to set it. | `SPC_13_tap_drag_and_hold_to_set_it.mp3` | `SPC_13-14_plasma_net_tap_drag_hold.mp3` |
| `17` | NICE! Great work, Cadet. | `SPC_praise_great_work.mp3` | `SPC_17_great_work.mp3` |
| `17b` | NICE! Great work, Cadet. | `SPC_praise_nice_great_work_cadet.mp3` | `SPC_17b_nice_great_work.mp3` |
| `18` | Now let the plasma recharge and do it again! | `SPC_13_now_let_the_plasma_recharge_and_do_it_again.mp3` | `SPC_18_plasma_recharge_again.mp3` |
| `19` | Plasma is recharged. | `SPC_plasma_is_recharged.mp3` | `SPC_19_plasma_recharged.mp3` |
| `20` | Make sure the stroids are targeted first. | `SPC_make_sure_the_stroids_are_targeted_first.mp3` | `SPC_20_targeted_first.mp3` |
| `21` | Try it again. | `SPC_try_it_again.mp3` | `SPC_21_try_again.mp3` |
| `22` | Take your time — get them highlighted before you release. | `SPC_take_your_time_get_them_highlighted.mp3` | `SPC_22_take_your_time.mp3` |
| `23` | UFO spotted, Cadet! | `SPC_UFO_spotted_cadet.mp3` | `SPC_23_ufo_spotted.mp3` |
| `24` | Shoot it twice to take it out! | `SPC_UFO-shoot_it_twice.mp3` | `SPC_24_shoot_it_twice.mp3` |
| `25` | Direct hit! Do it again! | `SPC_direct_hit.mp3` *(partial — drops "do it again")* | `SPC_25_direct_hit.mp3` |
| `26` | Wow, there you go. | `SPC_UFO_praise_wow_there_you_go.mp3` | `SPC_26_wow_there_you_go.mp3` |
| `27` | Destroying a UFO instantly recharges your plasma. | `SPC_UFO-destroying_a_ufo_instantly_recharges.mp3` | `SPC_27_ufo_recharges_plasma.mp3` |
| `31` | Use your plasma net on those stroids. | `SPC_use_your_plasma_net_on_those_stroids.mp3` | `SPC_31_use_plasma_net.mp3` |
| `32` | Now destroy the UFO quickly! | `SPC_UFO-now_destroy_the_ufo_quickly.mp3` | `SPC_32_destroy_ufo_quickly.mp3` |
| `33` | Plasma recharged — make another net! | `SPC_plasma_recharged_make_another_net.mp3` | `SPC_33_plasma_recharged_another_net.mp3` |
| `34` | Nice work, Cadet. You learn fast. | `SPC_UFO-net-combo-praise_nice_work_cadet_you_learn_fast.mp3` | `SPC_34_nice_work_learn_fast.mp3` |
| `38` | You have to swipe or flick to toss it. | `SPC_stroid-fail_You_have_to_swipe_or_flick_to_toss_it.mp3` | `SPC_38_swipe_or_flick.mp3` |
| `39` | Give it a good flick, Cadet — put some effort in! | `SPC_toss_give_it_a_good_flick_cadet.mp3` *(partial)* | `SPC_39_good_flick.mp3` |
| `40` | Very good, Cadet. | `SPC_toss-praise_very_good_cadet.mp3` | `SPC_40_very_good.mp3` |
| `41` | Things will get hectic out there. | `SPC_landmine1_things_will_get_hectic_out_there.mp3` *(mislabeled "landmine1")* | `SPC_41_things_get_hectic.mp3` |
| `46` | Okay Cadet, let's detonate the bomb ourselves. | `SPC_landmine_lets_detonate_the_bomb_ourselves.mp3` | `SPC_46_lets_detonate_ourselves.mp3` |
| `47` | Tap the armed bomb to detonate it. | `SPC_landmine_tap_the_armed_bomb_to_detonate_it.mp3` | `SPC_47_tap_armed_bomb.mp3` |
| `48` | Boom. That was fantastic, Cadet. | `SPC_landmine-praise_Boom_that_was_fantastic.mp3` | `SPC_48_boom_fantastic.mp3` |
| `49` | Bombs can save you from some hairy situations. | `SPC_bombs_bombs_can_save_you_from_some_hairy_situations.mp3` | `SPC_49_bombs_save_you.mp3` |
| `55` | Throughout the missions, power-ups appear. | `SPC_powerups_throughout_your_missions_powerups_will_appear.mp3` | `SPC_55_powerups_appear.mp3` |
| `56` | That's the quad shot power-up. Pick it up! | `SPC_quad_thats_the_quad_shot.mp3` *(partial — drops "pick it up")* | `SPC_56_quad_shot.mp3` |
| `58` | Keep firing, Cadet! | `SPC_quad_keep_firing_only_play_once.mp3` | `SPC_58_keep_firing.mp3` |
| `61` | Objects are frozen for a short time. Blast 'em! | `SPC_freeze_objects_are_frozen_for_a_short_time.mp3` *(partial — drops "blast 'em")* | `SPC_61_objects_frozen.mp3` |
| `63` | Good shooting — but try grabbing and tossing a frozen stroid. | `SPC_freeze_but_try_grabbing_and_tossing_a_frozen_stroid.mp3` *(partial — drops "good shooting")* | `SPC_63_try_tossing_frozen.mp3` |
| `64` | Very cool, Cadet. | `SPC_freeze-praise_very_cool_cadet.mp3` | `SPC_64_very_cool.mp3` |
| `65` | Pick up the missiles, Cadet. | `SPC_missile_pick_up_the_missiles_cadet.mp3` | `SPC_65_pick_up_missiles.mp3` |
| `66` | Tap the missile weapon in the HUD to arm a missile. | `SPC_missile2_tap_the_missile_in_hud_to_arm.mp3` | `SPC_66_arm_missile.mp3` |
| `67` | Now tap to set a target and watch the destruction. | `SPC_missile_now_tap_a_target_and_watch_the_destruction.mp3` | `SPC_67_set_target.mp3` |
| `68` | Excellent work, Cadet. | `SPC_freeze-toss-praise_excellent_work_cadet.mp3` *(mislabeled "freeze-toss")* | `SPC_68_excellent_work.mp3` |
| `69` | This concludes our training for today. | `SPC_training-end_this_concludes_our_training_for_today.mp3` | `SPC_69_training_complete.mp3` |
| `70` | Go practice if you like — the Polyverse awaits. | `SPC_training-end2_go_practice_if_you_like.mp3` *(partial — drops "Polyverse awaits")* | `SPC_70_go_practice.mp3` |
| `freeze_toggle` | Freeze can be enabled and disabled by tapping the freeze icon on your HUD. | `SPC_freeze_toggle.mp3` | *(unchanged)* |
| `grab_small` | Smaller stroids cannot be grabbed, Cadet. *(gameplay hint, not a tutorial phase)* | `SPC_grab_small.mp3` | *(unchanged)* |

---

## 3. Final `SPC_VO_FILES` map (the reconciliation)

Every key the `spcVO()` calls actually pass → its final filename. This replaces the `SPC_VO_AVAILABLE` Set. **Keys with no entry remain text-only** (intentional until recorded — see §5).

```js
const SPC_VO_FILES = new Map([
  ["01",            "SPC_01_welcome_to_polyverse.mp3"],
  ["07",            "SPC_07_timer_paused.mp3"],
  ["08-09",         "SPC_08-09_these_are_the_stroids.mp3"],
  ["12",            "SPC_12_show_stroids_whos_boss.mp3"],
  ["13-14",         "SPC_13-14_plasma_net_tap_drag_hold.mp3"],
  ["15-16",         "SPC_15-16_stroids_glow_release_to_fire.mp3"],   // concat
  ["17",            "SPC_17_great_work.mp3"],
  ["17b",           "SPC_17b_nice_great_work.mp3"],
  ["18",            "SPC_18_plasma_recharge_again.mp3"],
  ["19",            "SPC_19_plasma_recharged.mp3"],
  ["20",            "SPC_20_targeted_first.mp3"],
  ["21",            "SPC_21_try_again.mp3"],
  ["22",            "SPC_22_take_your_time.mp3"],
  ["23",            "SPC_23_ufo_spotted.mp3"],
  ["24",            "SPC_24_shoot_it_twice.mp3"],
  ["25",            "SPC_25_direct_hit.mp3"],
  ["26",            "SPC_26_wow_there_you_go.mp3"],
  ["27",            "SPC_27_ufo_recharges_plasma.mp3"],
  ["28-30",         "SPC_28-30_net_stroids_pop_ufo_combo.mp3"],      // concat
  ["31",            "SPC_31_use_plasma_net.mp3"],
  ["32",            "SPC_32_destroy_ufo_quickly.mp3"],
  ["33",            "SPC_33_plasma_recharged_another_net.mp3"],
  ["34",            "SPC_34_nice_work_learn_fast.mp3"],
  ["35-36",         "SPC_35-36_stroid_toss_tap_and_hold.mp3"],       // concat
  ["38",            "SPC_38_swipe_or_flick.mp3"],
  ["39",            "SPC_39_good_flick.mp3"],
  ["40",            "SPC_40_very_good.mp3"],
  ["41",            "SPC_41_things_get_hectic.mp3"],
  ["42-43",         "SPC_42-43_bomb_arm_grab_toss.mp3"],             // concat
  ["44-45",         "SPC_44-45_bomb_explodes_detonate_yourself.mp3"],// concat
  ["46",            "SPC_46_lets_detonate_ourselves.mp3"],
  ["47",            "SPC_47_tap_armed_bomb.mp3"],
  ["48",            "SPC_48_boom_fantastic.mp3"],
  ["49",            "SPC_49_bombs_save_you.mp3"],
  ["50-51",         "SPC_50-51_bomb_powerup_add_to_hud.mp3"],        // concat
  ["52-54",         "SPC_52-54_bomb_icon_place_arm_detonate.mp3"],   // concat x3
  ["55",            "SPC_55_powerups_appear.mp3"],
  ["56",            "SPC_56_quad_shot.mp3"],
  ["58",            "SPC_58_keep_firing.mp3"],
  ["59-60",         "SPC_59-60_freeze_pickup_activate.mp3"],         // concat
  ["61",            "SPC_61_objects_frozen.mp3"],
  ["freeze_toggle", "SPC_freeze_toggle.mp3"],                        // unchanged
  ["62",            "SPC_62_frozen_stroids_grab_toss.mp3"],          // concat
  ["63",            "SPC_63_try_tossing_frozen.mp3"],
  ["63b",           "SPC_63b_freeze_expired_grab_another.mp3"],      // concat
  ["64",            "SPC_64_very_cool.mp3"],
  ["65",            "SPC_65_pick_up_missiles.mp3"],
  ["66",            "SPC_66_arm_missile.mp3"],
  ["67",            "SPC_67_set_target.mp3"],
  ["68",            "SPC_68_excellent_work.mp3"],
  ["69",            "SPC_69_training_complete.mp3"],
  ["70",            "SPC_70_go_practice.mp3"],
  ["grab_small",    "SPC_grab_small.mp3"],                           // gameplay hint, unchanged

  // ── Bonus / ambient callouts — resolved via the SEPARATE spcBonusVoSrc() path
  // (SPC_BONUS_AVAILABLE, script.js:1311), NOT spcVO(). Kept here only to preserve the
  // existing gate; filenames already match SPC_<key>.mp3 and exist on disk. Leave untouched.
  ["amazing",       "SPC_amazing.mp3"],
  ["boom_like_that","SPC_boom_like_that.mp3"],
  ["crushing_it",   "SPC_crushing_it.mp3"],
  ["lets_get_after_it","SPC_lets_get_after_it.mp3"],
  ["not_doing_hot", "SPC_not_doing_hot.mp3"],
  ["peeing_pants",  "SPC_peeing_pants.mp3"],
  ["show_boss",     "SPC_show_boss.mp3"],
  ["there_you_go",  "SPC_there_you_go.mp3"],
  ["timer_warning", "SPC_timer_warning.mp3"],
  // SPC_BONUS_001..075 likewise stay on the spcBonusVoSrc path — not listed here.
]);
```

**Dropped vs the old Set** (orphan keys with no `spcVO()` caller — do NOT carry forward): `21`-as-split-pair artifacts aside, the unused split keys `35,36,50,51,52,53,54,59,60` and the never-called `37,54_alt,55-56,15-16_release,28-30_part2,62_part1,63b_part1,63b_part2`. These were the Set's compound-vs-split mismatch; the Map keys above match the **actual call keys** instead.

---

## 4. CONFIRM BY EAR before merging (ambiguous / unverifiable from filenames)

| Item | Why it's flagged | Needed |
|------|------------------|--------|
| Intro `02`, `03`, `04a`, `04b` ↔ `SPC_01_splitB/C/D.mp3` | Split files have **no words in their names** — can't tell which split is which caption, or even if all four captions are covered. `splitE` is named `…_tap_it_now`, which belongs to **line 06**, not the intro — so the A–E splits do **not** map cleanly onto 01–04b. | Listen to splitB/C/D/E, assign each to a caption (or mark for re-record). **Until resolved, these 4 keys stay text-only.** |
| `06` "Grab it to buy time. Tap it now." | Only the "tap it now" half exists (`SPC_01_splitE`). The "grab it to buy time" half is unaccounted. | Listen to splitE; decide partial-vs-rerecord. |
| `08-09` take selection | Two takes exist: the already-wired `SPC_08-09.mp3` and descriptive `SPC_08_these_are_the_stroids.mp3`. Also unclear whether either includes the caption's "…our job is to clear them from the Polyverse." | Pick the take; confirm full-line coverage. |
| `17` vs `17b` | Two near-identical praise takes (`praise_great_work` / `praise_nice_great_work_cadet`) for two identical captions. Assignment is arbitrary but should match the better read to each slot. | Optional listen; not blocking. |
| `12` ← `SPC_08c_praise.mp3` | Positional/likely match only — filename says "praise," not the actual words. | Confirm it's "Fantastic, Cadet. You'll show these stroids who's boss." |
| 10 concat outputs | Order is inferred from caption word-order (high confidence). | One playback-QA pass post-merge to catch any reversed read. |

---

## 5. MUST RECORD (no usable file exists)

| Key | Caption | Note |
|-----|---------|------|
| `05` | Every so often a timer power-up appears. | No file at all. |
| `31b` | Good shot — but try the plasma net first, then the UFO. Let's run it again. | No file (`SPC_try_it_again` now belongs to key `21`). |
| `57` | Blast those stroids with the quad shot! | No file — do **not** reuse the laser-phase "blast the stroids" take. |
| `06` (partial) | Grab it to buy time. Tap it now. | Only "tap it now" exists. |
| `10-11` (partial) | Tap to fire your laser and blast the stroid and all its pieces. | Only "blast the stroids" (`SPC_08b`) exists; "tap to fire your laser" half missing. |
| `02`/`03`/`04a`/`04b` | intro monologue | Pending §4 listen — may already exist inside splitB/C/D. |

Until recorded, these keys have **no Map entry → caption plays text-only** (no regression; that's their state today).

---

## 6. Leftover orphans after this plan (unused, safe to archive)

| File | Disposition |
|------|-------------|
| `SPC_tossC_now_toss_and_release_to_toss_it_at_other_stroids.mp3` | Toss-**release** instruction; current `35-36` caption only covers grab. Hold for a possible future caption, or archive. |
| `SPC_08_these_are_the_stroids.mp3` | Alt take of `08-09` if the existing `SPC_08-09.mp3` is kept (§4). |
| `SPC_praise.mp3` | Generic 2.5s praise, no caption slot. Archive/keep as spare. |
| `SPC_01_splitC.wav` | 2.4 MB source dupe of `splitC.mp3`. Delete from bundle (earlier decision pending). |
| `old_SPC_01.mp3` | Superseded 18s original. Keep as backup until splits verified. |

---

## 7. Explicitly NOT touched by this plan

- **`pumpSpc` / the queue / the iOS race fixes** — zero changes. The whole point of Strategy 1.
- **`spcBonusVoSrc` + `SPC_BONUS_AVAILABLE`** (bonus/ambient gameplay callouts) — separate resolver path, left intact.
- **Caption text in `TUTORIAL_PHASES`** — unchanged; only the lookup table the keys resolve through changes.
- **`spcVO()` call sites** — unchanged; they keep passing the same keys (`"15-16"`, `"52-54"`, …).

## Execution order when greenlit (not done here)
1. Confirm §4 items by ear (esp. intro splits — they gate 02/03/04a/04b/06).
2. Run the 10 concats (§1) + single-file renames (§2) in `vo/`.
3. Swap `SPC_VO_AVAILABLE` Set → `SPC_VO_FILES` Map + one-line resolver change (§0, §3).
4. `node --check script.js && npm run prepare:web`; bump `BUILD_TS`.
5. Record §5 gaps; add their Map entries.
6. Correct the stale CLAUDE.md "verified 1:1 on 2026-06-17" note.
