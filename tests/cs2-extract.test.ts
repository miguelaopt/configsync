import { describe, expect, it } from "vitest";
import {
  convarFile,
  extractControls,
  mapSetting,
  parseConvars,
  parseStrings,
  type CatalogEntry,
} from "@/scripts/cs2-extract-settings";

// Excerpts of the real files (GameTracking-CS2 @ 3fc98e7), trimmed.
const strings = parseStrings(`
"lang" { "Tokens" {
		"settings_hud_section"		"Hud"
		"SFUI_Settings_HUD_Color"		"HUD Color"
		"SFUI_Settings_HUD_Color_0"		"Team Color"
		"SFUI_Settings_HUD_Color_1"		"White"
		"SFUI_Settings_Match_Ping_Threshold"	"Max Acceptable Matchmaking Ping"
		"GameUI_CrosshairLength"		"Length"
		"SFUI_Settings_Master_Volume"		"Master Volume"
		"SFUI_Scoreboard_Toggle"		"Scoreboard Mouse Enable /\\nEnd of Match Scoreboard Toggle"
		"SFUI_Forward"		"Move Forward"
		"SFUI_Settings_Shadows"		"Global Shadow Quality"
		"SFUI_CSM_Low"		"Low"
		"SFUI_CSM_High"		"High"
} }`);

const layout = `
<root>
  <Label class="SettingsSectionTitleLabel" text="#settings_hud_section" />
  <CSGOSettingsSlider text="#SFUI_Settings_Match_Ping_Threshold" max="350" min="25" convar="mm_dedicated_search_maxping" />
  <TooltipPanel class="SettingsMenuDropdownContainer">
    <Label text="#SFUI_Settings_HUD_Color" class="half-width" />
    <CSGOSettingsEnumDropDown class="PopupButton White" convar="cl_hud_color">
      <Label text="#SFUI_Settings_HUD_Color_0" value="0" />
      <Label text="#SFUI_Settings_HUD_Color_1" value="1" />
    </CSGOSettingsEnumDropDown>
  </TooltipPanel>
  <CSGOSettingsSlider text="#GameUI_CrosshairLength" max="255.0" min="0.0" convar="cl_crosshair_length" />
  <CSGOSettingsSlider text="#SFUI_Settings_Master_Volume" max="1" min="0" audiogain="true" percentage="true" convar="volume" />
  <CSGOSettingsKeyBinder text="#SFUI_Forward" id="MovFwdBinder" bind="+forward" />
  <Panel class="SettingsMenuDropdownContainer">
    <Label text="#SFUI_Settings_Shadows" class="half-width" />
    <CSGOSettingsEnumDropDown oninputsubmit="CSGOVideoChanged(&apos;&apos;)" id="CSMQuality">
      <Label text="#SFUI_CSM_Low" value="0" />
      <Label text="#SFUI_CSM_High" value="2" />
    </CSGOSettingsEnumDropDown>
  </Panel>
</root>`;
const controls = extractControls(layout, "settings_game.xml", "Game", strings);

const convars = parseConvars(`
mm_dedicated_search_maxping 150 (min: 25, max: 350, archive)
\t<no description>

cl_hud_color 0 (clientdll archive release)
cl_crosshair_length 8 (min: 0, max: 255, clientdll archive per_user)
cl_crosshairsize 3.9 (clientdll hidden archive per_user)
cl_crosshaircolor_r 0 (min: 0, max: 255, clientdll archive per_user)
volume 1 (min: 0, max: 1, archive)
voice_loopback false (userinfo)
`);

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  name: "",
  category: "Game",
  type: "text",
  aliases: [],
  options: [],
  where: "menu",
  ...over,
});
const map = (over: Partial<CatalogEntry>) =>
  mapSetting(
    entry(over),
    controls,
    convars,
    new Map([["cl_hud_color", "cs2_machine_convars.vcfg"]]),
  );

describe("parsing the game's files", () => {
  it("resolves strings, folding the game's line breaks", () => {
    expect(strings.get("sfui_scoreboard_toggle")).toBe(
      "Scoreboard Mouse Enable / End of Match Scoreboard Toggle",
    );
  });

  it("reads convar defaults, ranges and flags, and which file keeps each", () => {
    const length = convars.get("cl_crosshair_length")!;
    expect(length).toMatchObject({ default: "8", min: 0, max: 255 });
    expect(convarFile(length)).toBe("convars");
    expect(convarFile(convars.get("cl_hud_color"))).toBe("machine");
    expect(convarFile(convars.get("voice_loopback"))).toBeNull();
  });

  it("finds each control's name, section, convar or bind and stored choices", () => {
    expect(controls.map((c) => [c.name, c.kind, c.convar ?? c.bind])).toEqual([
      ["Max Acceptable Matchmaking Ping", "slider", "mm_dedicated_search_maxping"],
      ["HUD Color", "dropdown", "cl_hud_color"],
      ["Length", "slider", "cl_crosshair_length"],
      ["Master Volume", "slider", "volume"],
      ["Move Forward", "keybind", "+forward"],
      ["Global Shadow Quality", "dropdown", undefined],
    ]);
    expect(controls[1]).toMatchObject({
      section: "Hud",
      options: [
        { label: "Team Color", value: "0" },
        { label: "White", value: "1" },
      ],
    });
    expect(controls[0]).toMatchObject({ min: 25, max: 350 });
  });
});

describe("mapping catalog settings", () => {
  it("maps a labelled control to its convar, file and stored values", () => {
    expect(map({ name: "HUD Color" })).toMatchObject({
      status: "from-game",
      classification: "machine_config",
      source: { file: "machine", key: "cl_hud_color" },
      values: { "Team Color": "0", White: "1" },
    });
  });

  it("finds a setting by the catalog's own key when the game labels it differently", () => {
    expect(
      map({ name: "Move Up", category: "Keybinds", source: { file: "keys", bind: "+forward" } }),
    ).toMatchObject({
      status: "from-game",
      gameLabel: "Move Forward",
      source: { bind: "+forward" },
    });
  });

  it("flags a catalog key the game has replaced", () => {
    expect(
      map({
        name: "Length",
        category: "Crosshair",
        source: { file: "convars", key: "cl_crosshairsize" },
      }),
    ).toMatchObject({ status: "manual", source: { key: "cl_crosshair_length" } });
  });

  it("flags a catalog key that is hidden or gone when no control carries it", () => {
    expect(
      map({ name: "Old Size", source: { file: "convars", key: "cl_crosshairsize" } }).todo,
    ).toMatch(/legacy convar/);
    expect(
      map({ name: "Color", source: { file: "convars", key: "cl_crosshaircolor" } }).todo,
    ).toMatch(/no longer exists/);
  });

  it("infers the colour picker's channels from the dump, never claims them as the game's word", () => {
    expect(map({ name: "Red", category: "Crosshair" })).toMatchObject({
      status: "inferred",
      source: { file: "convars", key: "cl_crosshaircolor_r" },
    });
  });

  it("asks to confirm audio-gain sliders, whose stored value isn't the percentage", () => {
    expect(map({ name: "Master Volume", category: "Audio" })).toMatchObject({
      status: "inferred",
      range: { stored: "gain" },
    });
  });

  it("checks a code-handled control's values against the catalog's own key", () => {
    const shadows = (values: string[]) =>
      map({
        name: "Global Shadow Quality",
        category: "Video",
        where: "preset",
        options: values.map((v, i) => ({ label: `o${i}`, value: v })),
        source: { file: "video", key: "setting.videocfg_shadow_quality" },
      }).status;
    expect(shadows(["0", "2"])).toBe("inferred");
    expect(shadows(["0", "1"])).toBe("manual");
  });

  it("leaves a control the game wires in code, with nothing in the catalog, for csync discover", () => {
    expect(map({ name: "Global Shadow Quality", category: "Video" })).toMatchObject({
      status: "manual",
      values: { Low: "0", High: "2" },
    });
  });
});
