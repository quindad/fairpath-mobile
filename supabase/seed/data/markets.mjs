// Market plan for the DEV inventory seed.
//
//   jobs / housing : how many of each to generate in the market
//   wage / rent    : cost-of-market multipliers applied to base pay / base rent
//   zips           : [zip, neighborhood, cityOverride?]  (real ZIPs for the area)
//
// Coordinates are APPROXIMATE (city center + a stable per-ZIP offset, see build-inventory.mjs).
// Good enough for map pins and 10-100 mile radius tests; NOT for geocoding-accuracy tests.

export const MARKETS = [
  // ---- Focus region 1: Cleveland ------------------------------------------------------------
  { key: 'cleveland-oh', region: 'cleveland', city: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944, jobs: 14, housing: 8, wage: 0.97, rent: 0.85,
    zips: [['44113', 'Ohio City'], ['44114', 'Warehouse District'], ['44102', 'Detroit-Shoreway'], ['44103', 'Glenville'], ['44105', 'Slavic Village'],
      ['44106', 'University Circle'], ['44109', 'Old Brooklyn'], ['44115', 'Campus District'], ['44107', 'Lakewood', 'Lakewood'], ['44123', 'Euclid', 'Euclid'],
      ['44129', 'Parma', 'Parma'], ['44142', 'Brook Park', 'Brook Park']] },

  // ---- Focus region 2: Columbus -------------------------------------------------------------
  { key: 'columbus-oh', region: 'columbus', city: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988, jobs: 14, housing: 8, wage: 1.0, rent: 0.98,
    zips: [['43215', 'Brewery District'], ['43201', 'Short North'], ['43204', 'Hilltop'], ['43206', 'German Village'], ['43219', 'Northeast Columbus'],
      ['43228', 'West Columbus'], ['43229', 'Northland'], ['43223', 'South Side'], ['43232', 'Southeast Columbus'], ['43212', 'Grandview'],
      ['43123', 'Grove City', 'Grove City'], ['43081', 'Westerville', 'Westerville'], ['43026', 'Hilliard', 'Hilliard']] },

  // ---- Focus region 3: Washington DC / Maryland / Northern Virginia -------------------------
  { key: 'washington-dc', region: 'dc-md', city: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369, jobs: 6, housing: 4, wage: 1.18, rent: 1.55,
    zips: [['20001', 'Shaw'], ['20002', 'H Street NE'], ['20003', 'Capitol Hill'], ['20009', 'Adams Morgan'], ['20019', 'Deanwood'], ['20020', 'Anacostia'], ['20011', 'Petworth'], ['20032', 'Congress Heights']] },
  { key: 'baltimore-md', region: 'dc-md', city: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122, jobs: 6, housing: 4, wage: 1.05, rent: 1.1,
    zips: [['21201', 'Mount Vernon'], ['21202', 'Jonestown'], ['21217', 'Druid Heights'], ['21224', 'Highlandtown'], ['21230', 'Federal Hill'], ['21213', 'Broadway East'], ['21215', 'Park Heights'], ['21223', 'Carrollton Ridge']] },
  { key: 'silver-spring-md', region: 'dc-md', city: 'Silver Spring', state: 'MD', lat: 39.0, lng: -77.05, jobs: 4, housing: 3, wage: 1.15, rent: 1.4,
    zips: [['20910', 'Downtown Silver Spring'], ['20901', 'Four Corners'], ['20904', 'Colesville'], ['20850', 'Rockville', 'Rockville'], ['20852', 'North Bethesda', 'Rockville']] },
  { key: 'pg-county-md', region: 'dc-md', city: 'Hyattsville', state: 'MD', lat: 38.93, lng: -76.93, jobs: 4, housing: 3, wage: 1.08, rent: 1.25,
    zips: [['20782', 'Hyattsville'], ['20743', 'Capitol Heights', 'Capitol Heights'], ['20785', 'Landover', 'Landover'], ['20706', 'Lanham', 'Lanham'], ['20740', 'College Park', 'College Park'], ['20770', 'Greenbelt', 'Greenbelt']] },
  { key: 'arlington-va', region: 'dc-md', city: 'Arlington', state: 'VA', lat: 38.88, lng: -77.09, jobs: 2, housing: 1, wage: 1.2, rent: 1.6,
    zips: [['22201', 'Clarendon'], ['22202', 'Crystal City']] },

  // ---- Other US markets (location / radius stress testing) ----------------------------------
  { key: 'pittsburgh-pa', region: 'other', city: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959, jobs: 3, housing: 2, wage: 0.98, rent: 0.95, zips: [['15219', 'Hill District'], ['15206', 'East Liberty'], ['15212', 'North Side']] },
  { key: 'philadelphia-pa', region: 'other', city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, jobs: 4, housing: 3, wage: 1.08, rent: 1.15, zips: [['19103', 'Center City'], ['19134', 'Kensington'], ['19121', 'Brewerytown'], ['19143', 'Kingsessing']] },
  { key: 'cincinnati-oh', region: 'other', city: 'Cincinnati', state: 'OH', lat: 39.1031, lng: -84.512, jobs: 3, housing: 2, wage: 0.97, rent: 0.93, zips: [['45202', 'Downtown'], ['45219', 'Clifton'], ['45214', 'Westwood']] },
  { key: 'detroit-mi', region: 'other', city: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458, jobs: 4, housing: 3, wage: 0.98, rent: 0.82, zips: [['48201', 'Midtown'], ['48207', 'Eastside'], ['48219', 'Rosedale Park'], ['48226', 'Downtown']] },
  { key: 'chicago-il', region: 'other', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, jobs: 4, housing: 3, wage: 1.1, rent: 1.2, zips: [['60601', 'The Loop'], ['60612', 'Near West Side'], ['60622', 'Wicker Park'], ['60644', 'Austin'], ['60632', 'Brighton Park']] },
  { key: 'indianapolis-in', region: 'other', city: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581, jobs: 3, housing: 2, wage: 0.96, rent: 0.9, zips: [['46204', 'Downtown'], ['46202', 'Near Northside'], ['46225', 'Fountain Square']] },
  { key: 'atlanta-ga', region: 'other', city: 'Atlanta', state: 'GA', lat: 33.749, lng: -84.388, jobs: 4, housing: 3, wage: 1.02, rent: 1.1, zips: [['30303', 'Downtown'], ['30310', 'West End'], ['30314', 'Vine City'], ['30318', 'Westside']] },
  { key: 'charlotte-nc', region: 'other', city: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, jobs: 3, housing: 2, wage: 1.0, rent: 1.05, zips: [['28202', 'Uptown'], ['28206', 'NoDa'], ['28208', 'West Charlotte']] },
  { key: 'houston-tx', region: 'other', city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, jobs: 4, housing: 3, wage: 1.0, rent: 0.98, zips: [['77002', 'Downtown'], ['77003', 'EaDo'], ['77004', 'Third Ward']] },
  { key: 'dallas-tx', region: 'other', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.797, jobs: 3, housing: 2, wage: 1.02, rent: 1.02, zips: [['75201', 'Uptown'], ['75215', 'South Dallas'], ['75212', 'West Dallas']] },
  { key: 'nashville-tn', region: 'other', city: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, jobs: 3, housing: 2, wage: 1.0, rent: 1.12, zips: [['37203', 'The Gulch'], ['37211', 'Nolensville Pike']] },
  { key: 'louisville-ky', region: 'other', city: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585, jobs: 2, housing: 0, wage: 0.94, rent: 0.9, zips: [['40202', 'Downtown'], ['40203', 'Old Louisville']] },
  { key: 'phoenix-az', region: 'other', city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074, jobs: 3, housing: 2, wage: 1.03, rent: 1.08, zips: [['85004', 'Downtown'], ['85008', 'East Phoenix']] },
  { key: 'denver-co', region: 'other', city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, jobs: 2, housing: 2, wage: 1.12, rent: 1.3, zips: [['80202', 'LoDo'], ['80205', 'Five Points']] },
  { key: 'seattle-wa', region: 'other', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, jobs: 2, housing: 1, wage: 1.25, rent: 1.5, zips: [['98101', 'Downtown'], ['98134', 'SODO']] },
  { key: 'los-angeles-ca', region: 'other', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, jobs: 3, housing: 2, wage: 1.2, rent: 1.65, zips: [['90012', 'Chinatown'], ['90015', 'South Park'], ['90021', 'Arts District']] },
  { key: 'oakland-ca', region: 'other', city: 'Oakland', state: 'CA', lat: 37.8044, lng: -122.2712, jobs: 2, housing: 0, wage: 1.22, rent: 1.5, zips: [['94607', 'West Oakland'], ['94621', 'East Oakland']] },
  { key: 'miami-fl', region: 'other', city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, jobs: 3, housing: 2, wage: 1.04, rent: 1.45, zips: [['33130', 'Brickell'], ['33127', 'Wynwood'], ['33147', 'Liberty City']] },
  { key: 'orlando-fl', region: 'other', city: 'Orlando', state: 'FL', lat: 28.5384, lng: -81.3789, jobs: 2, housing: 1, wage: 0.98, rent: 1.15, zips: [['32801', 'Downtown'], ['32805', 'Parramore']] },
  { key: 'memphis-tn', region: 'other', city: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.049, jobs: 2, housing: 1, wage: 0.92, rent: 0.85, zips: [['38103', 'Downtown'], ['38106', 'South Memphis']] },
  { key: 'milwaukee-wi', region: 'other', city: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065, jobs: 0, housing: 1, wage: 0.96, rent: 0.88, zips: [['53202', 'East Side'], ['53212', 'Riverwest']] },
];

export const FOCUS_REGIONS = ['cleveland', 'columbus', 'dc-md'];
