// TEST offense catalog for DEV. Offense TITLES are generic; every CODE is a "DEV-" test code and
// every row says so in source_agency/source_url. This is NOT a legal reference: the real catalog needs
// official statute sources, effective dates and last_verified_at. Rows here have last_verified_at = NULL.
//
// category labels match the provisional 9-category taxonomy display labels
// (supabase/migrations/20260924150002_offense_taxonomy.sql).

export const OFFENSE_POOL = [
  // [category, title, level, aliases]
  ['Violence', 'Assault', 'misdemeanor', ['Simple assault']],
  ['Violence', 'Aggravated Assault', 'felony', ['Felonious assault']],
  ['Violence', 'Robbery', 'felony', []],
  ['Violence', 'Domestic Violence', 'misdemeanor', ['DV']],
  ['Violence', 'Manslaughter', 'felony', []],
  ['Violence', 'Menacing / Criminal Threats', 'misdemeanor', ['Terroristic threats']],
  ['Weapons', 'Carrying a Concealed Weapon', 'misdemeanor', ['CCW']],
  ['Weapons', 'Unlawful Firearm Possession', 'felony', ['Weapon under disability', 'Felon in possession']],
  ['Weapons', 'Discharging a Firearm in a Prohibited Area', 'misdemeanor', []],
  ['Drugs', 'Possession of a Controlled Substance', 'felony', ['Drug possession']],
  ['Drugs', 'Drug Trafficking', 'felony', ['Possession with intent to distribute']],
  ['Drugs', 'Possession of Marijuana', 'misdemeanor', ['Cannabis possession']],
  ['Drugs', 'Possession of Drug Paraphernalia', 'misdemeanor', []],
  ['Property / Theft', 'Theft', 'misdemeanor', ['Petty theft', 'Larceny']],
  ['Property / Theft', 'Grand Theft', 'felony', ['Grand larceny']],
  ['Property / Theft', 'Burglary', 'felony', ['Breaking and entering']],
  ['Property / Theft', 'Receiving Stolen Property', 'misdemeanor', []],
  ['Property / Theft', 'Criminal Damaging / Vandalism', 'misdemeanor', ['Vandalism']],
  ['Property / Theft', 'Criminal Trespass', 'misdemeanor', ['Trespass']],
  ['Property / Theft', 'Motor Vehicle Theft', 'felony', ['Grand theft auto']],
  ['Fraud / Financial', 'Forgery', 'felony', []],
  ['Fraud / Financial', 'Identity Fraud', 'felony', ['Identity theft']],
  ['Fraud / Financial', 'Passing Bad Checks', 'misdemeanor', ['Check fraud']],
  ['Fraud / Financial', 'Embezzlement', 'felony', []],
  ['Fraud / Financial', 'Public Benefits Fraud', 'felony', ['Welfare fraud']],
  ['Sex Offenses', 'Public Indecency (Indecent Exposure)', 'misdemeanor', []],
  ['Sex Offenses', 'Sexual Battery', 'felony', []],
  ['Driving / Vehicle', 'Operating a Vehicle While Impaired', 'misdemeanor', ['DUI', 'DWI', 'OVI']],
  ['Driving / Vehicle', 'Driving Under Suspension', 'misdemeanor', ['DUS']],
  ['Driving / Vehicle', 'Reckless Driving', 'misdemeanor', []],
  ['Driving / Vehicle', 'Leaving the Scene of an Accident', 'felony', ['Hit and run']],
  ['Driving / Vehicle', 'Driving Without a License', 'misdemeanor', []],
  ['Public Order', 'Disorderly Conduct', 'misdemeanor', ['Disturbing the peace']],
  ['Public Order', 'Resisting Arrest', 'misdemeanor', []],
  ['Public Order', 'Obstructing Official Business', 'misdemeanor', []],
  ['Public Order', 'Loitering', 'misdemeanor', []],
  ['Public Order', 'Contempt of Court', 'misdemeanor', []],
  ['Other', 'Failure to Appear', 'misdemeanor', ['Bail jumping']],
  ['Other', 'Probation Violation', 'misdemeanor', ['Technical violation']],
  ['Other', 'Failure to Pay Child Support', 'felony', ['Criminal nonsupport']],
];

// [name, state_code, jurisdiction_type, extraEntries]   (extras = entries beyond one-per-category)
export const OFFENSE_JURISDICTIONS = [
  ['Federal', null, 'federal', 6],
  ['Ohio', 'OH', 'state', 6], ['Maryland', 'MD', 'state', 6], ['District of Columbia', 'DC', 'state', 6],
  ['Virginia', 'VA', 'state', 2], ['Pennsylvania', 'PA', 'state', 2], ['Michigan', 'MI', 'state', 2], ['Illinois', 'IL', 'state', 2],
  ['Indiana', 'IN', 'state', 2], ['Georgia', 'GA', 'state', 2], ['North Carolina', 'NC', 'state', 2], ['Texas', 'TX', 'state', 2],
  ['Tennessee', 'TN', 'state', 2], ['Kentucky', 'KY', 'state', 2], ['Arizona', 'AZ', 'state', 2], ['Colorado', 'CO', 'state', 2],
  ['Washington', 'WA', 'state', 2], ['California', 'CA', 'state', 2], ['Florida', 'FL', 'state', 2], ['Wisconsin', 'WI', 'state', 2],
];

export const OFFENSE_SOURCE_AGENCY = 'DEV TEST DATA (not an official statute source)';
export const OFFENSE_SOURCE_URL = 'https://example.com/fairpath-dev-seed/offense-catalog';
export const OFFENSE_EFFECTIVE_START = '2024-01-01';
