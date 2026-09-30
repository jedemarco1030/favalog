export const LEGACY_DEMONSTRATION_IDS = [
  "m_afterglow",
  "m_paperlantern",
  "m_lowcountry",
  "m_duneparttwo",
  "m_quietsignal",
  "m_thecartographer",
  "m_nightferry",
  "m_arclighthouse",
  "m_bluehourrun",
  "m_slowmountain",
  "t_northlight",
  "t_gildedroom",
  "t_harbourlines",
  "t_latecheckin",
  "t_signalglass",
  "t_ridgeandriver",
  "t_paperwatch",
  "t_undertheeaves",
  "b_smallhours",
  "b_orbital_notes",
  "b_bright_index",
  "b_salt_tide",
  "b_weight_of_sand",
  "b_northroom",
  "b_paperbirds",
  "b_quietinstruments",
  "b_seasofglass",
  "b_theslowdial",
] as const;

const legacyIds = new Set<string>(LEGACY_DEMONSTRATION_IDS);

export function isDemonstrationIdentity(
  source: string,
  externalId: string,
): boolean {
  return source === "favalog" && legacyIds.has(externalId);
}

// Apply BEFORE pagination/counts; filtering the returned page would lose items.
export const PRODUCTION_CATALOG_FILTER = `source.neq.favalog,external_id.not.in.(${LEGACY_DEMONSTRATION_IDS.join(",")})`;
