# Testing the companion on Windows

The companion was written for Windows and Linux but has only ever run on Linux. This is the
walk-through for the Windows boot: what to do, what you should see, and what to write down
when it does not match. Do it top to bottom once; every later Windows change only needs the
step it touches.

Before you start, on Windows:

- Steam signed in, **Counter-Strike 2 installed and started at least once** (that is what
  writes `cs2_video.txt` and the `.vcfg` files).
- Optional: Rocket League on Epic, started once.
- Your ConfigSync account is Pro (steps 7–9 need it). Have <https://configsync.app> open.
- Note your Windows version: Settings → System → About (e.g. "Windows 11 24H2").

Write results in the table at the end as you go.

---

## 1. Download and first run

1. Open <https://configsync.app/docs/companion> → **Install on Windows** → download
   `csync-windows-x64.exe`. Expect ~90 MB.
2. Create `C:\Tools`, move the file there and rename it `csync.exe`.
3. If Edge/Chrome say the file is "not commonly downloaded" → Keep. Right-click `csync.exe` →
   Properties → if there is an **Unblock** checkbox, tick it → OK.
4. Open PowerShell in that folder (Shift + right-click in the folder → "Open PowerShell window
   here", or `cd C:\Tools`).
5. `.\csync.exe --help`

**Expect:** the command list, starting `csync — ConfigSync companion`.
**If "Windows protected your PC" appears:** More info → Run anyway. Note that it appeared
(it will, the file is not signed).
**If Defender quarantines the file:** note the detection name. That is a blocker to fix before
anyone else downloads it.

## 2. Log in

1. On the site: Settings → Companion → New token → name it `Windows PC` → Create token → Copy.
2. `.\csync.exe login https://configsync.app` → paste the token → Enter.

**Expect:** `Logged in as <your email>. Saved to C:\Users\<you>\AppData\Roaming\csync\config.json`.
Open that path in Explorer and confirm the file exists.

## 3. Scan

`.\csync.exe scan --push`

**Expect:** a line per installed Steam (and Epic) game, `Counter-Strike 2` among them, then
`Sent N games as "<your PC name>"`.
On the site: Settings → Companion → **Devices** lists the Windows PC with platform **Windows**
and the game count. Games → Counter-Strike 2 → **On your PCs** shows it too.

**If Steam is not under `C:\Program Files (x86)\Steam`** (e.g. `D:\Steam`) and the scan finds
nothing: run `reg query HKCU\Software\Valve\Steam /v SteamPath` and paste the output in the
report — the companion reads that key and it should have worked.

## 4. Files

`.\csync.exe games`

**Expect** under `cs2 — Counter-Strike 2` three paths, all inside
`…\Steam\userdata\<number>\730\local\cfg\`: `cs2_video.txt`, `cs2_user_convars_0_slot0.vcfg`,
`cs2_user_keys_0_slot0.vcfg`, and a line `Steam launch options: C:\Tools\csync.exe launch cs2 -- %command%`.

**If a file says "not found on this machine":** open the folder in Explorer, list what is there,
paste the names. (Two Steam accounts on the PC → the most recently used one wins; say which
account you are logged into.)

## 5. Import — read the real files

1. In CS2 first, note three values you can recognise: Video → resolution, Keyboard/Mouse →
   sensitivity, and one keybind (e.g. what key is bound to Jump). Close CS2.
2. `.\csync.exe import cs2 --name "Windows import"`

**Expect:** `Created preset: https://configsync.app/games/counter-strike-2/windows-import` and a
line about settings that are not stored in files (that is normal). Open the URL: the three
values you noted must match. Every other value should look plausible (no empty cells, no raw
`0`/`1` where the game shows words).

**If a value is wrong:** paste the setting name, what the game shows, what the preset shows.

## 6. Apply — write the files, with a backup

1. On the site, in the "Windows import" preset, change **Mouse Sensitivity** to a number you
   would never use, e.g. `1.23`. Save.
2. CS2 closed. `.\csync.exe apply cs2 windows-import --dry-run`

   **Expect:** the sensitivity line as a change, nothing written.

3. `.\csync.exe apply cs2 windows-import`

   **Expect:** "applied", and in the `cfg` folder new files `cs2_user_convars_0_slot0.vcfg.bak-<timestamp>`
   (one per touched file).

4. Start CS2 → Settings → Keyboard/Mouse. **Expect** sensitivity `1.23`. Close CS2.
5. Set sensitivity back to your real value on the site and `apply` again — or copy the `.bak-*`
   file back over the original. Confirm in CS2.

**If CS2 shows the old value:** Steam Cloud restored the file. Steam → CS2 → Properties →
General → turn off Steam Cloud for this game → apply again → note it in the report.

## 7. Background sync (Pro): one pass

`.\csync.exe watch --once`

**Expect:** `watching 2 catalog games …` then per game `up to date` or `applied`. On the site:
Games → Counter-Strike 2 → **On your PCs** → the Windows PC shows **Synced** with a fresh time.

## 8. Background sync: autostart

1. `.\csync.exe watch --install`

   **Expect:** `Installed C:\Users\<you>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\csync-watch.cmd`.
   Open that folder; the file is there. Open it with Notepad: one line ending
   `"C:\Tools\csync.exe" watch`.

2. Sign out of Windows and back in (or just double-click the `.cmd`).

   **Expect:** a minimised console window titled csync appears in the taskbar and stays.

3. With CS2 closed, on the site (phone is ideal) change the CS2 **Default** preset to another
   one (make one with a different sensitivity first).

   **Expect:** within ~30 s the game page shows the Windows PC **Synced** with a new time, and
   the `.vcfg` file's modified time is now.

4. Start CS2 and leave it open. Change the Default again on the site.

   **Expect:** the game page shows the Windows PC as **waiting** (game running), nothing written.
   Close CS2 → within ~30 s it flips to **Synced**.

5. `.\csync.exe watch --uninstall` → the `.cmd` is gone. Close the minimised window.

## 9. Launch wrapper

1. Steam → CS2 → Properties → General → Launch Options:
   `"C:\Tools\csync.exe" launch cs2 -- %command%`
2. On the site, set the Default preset to one with sensitivity `1.23`. CS2 closed.
3. Press Play in Steam.

**Expect:** CS2 starts normally and the sensitivity is `1.23`. (A console window may flash for
a second before the game — note if it does.)
Set the Default back afterwards and remove the launch option.

## 10. Rocket League on Epic (only if installed)

`.\csync.exe games` should list `TASystemSettings.ini` and `TAInput.ini` under
`Documents\My Games\Rocket League\TAGame\Config\`. Then `import rocket-league`, open the preset,
check camera FOV and one keybind. Epic launch wrapper is not tested — Epic has no launch
options field.

---

## Report

Fill this in and send it (or paste it into a Claude/ChatGPT session). Exact output beats
descriptions: select the PowerShell text, Enter copies it.

| Step | OK? | What you saw / pasted output                      |
| ---- | --- | ------------------------------------------------- |
| 1    |     | SmartScreen: yes/no · Defender: yes/no            |
| 2    |     |                                                   |
| 3    |     | devices list ok? platform shown?                  |
| 4    |     | three paths found? launch line?                   |
| 5    |     | 3 values matched? any wrong value → name + values |
| 6    |     | .bak created? CS2 showed 1.23? Cloud restored?    |
| 7    |     |                                                   |
| 8    |     | .cmd path · synced in 30 s? waiting while open?   |
| 9    |     | game started? value applied? console flash?       |
| 10   |     |                                                   |

Windows version: · Steam path: · Two Steam accounts on this PC: yes/no
