export interface Neighborhood {
  name: string;
  city: string;
  borough?: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  nearbyNeighborhoods?: string[];
}

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

export const NEIGHBORHOODS: Record<string, Neighborhood> = {
  'Williamsburg': {
    name: 'Williamsburg',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7081, lng: -73.9571 },
    nearbyNeighborhoods: ['Greenpoint', 'Bushwick', 'East Williamsburg'],
  },
  'Bushwick': {
    name: 'Bushwick',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6942, lng: -73.9196 },
    nearbyNeighborhoods: ['East Williamsburg', 'Williamsburg', 'Bedford-Stuyvesant'],
  },
  'Park Slope': {
    name: 'Park Slope',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6710, lng: -73.9778 },
    nearbyNeighborhoods: ['Gowanus', 'Prospect Heights', 'Carroll Gardens'],
  },
  'DUMBO': {
    name: 'DUMBO',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7033, lng: -73.9888 },
    nearbyNeighborhoods: ['Brooklyn Heights', 'Vinegar Hill', 'Downtown Brooklyn'],
  },
  'Brooklyn Heights': {
    name: 'Brooklyn Heights',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6958, lng: -73.9936 },
    nearbyNeighborhoods: ['DUMBO', 'Downtown Brooklyn', 'Cobble Hill'],
  },
  'Bedford-Stuyvesant': {
    name: 'Bedford-Stuyvesant',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6872, lng: -73.9418 },
    nearbyNeighborhoods: ['Bushwick', 'Crown Heights', 'Clinton Hill'],
  },
  'Crown Heights': {
    name: 'Crown Heights',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.6683, lng: -73.9420 },
    nearbyNeighborhoods: ['Bedford-Stuyvesant', 'Prospect Heights', 'Flatbush'],
  },
  'Greenpoint': {
    name: 'Greenpoint',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7304, lng: -73.9515 },
    nearbyNeighborhoods: ['Williamsburg', 'Long Island City'],
  },
  'East Williamsburg': {
    name: 'East Williamsburg',
    city: 'New York',
    borough: 'Brooklyn',
    state: 'NY',
    coordinates: { lat: 40.7135, lng: -73.9361 },
    nearbyNeighborhoods: ['Williamsburg', 'Bushwick', 'Greenpoint'],
  },
  'Upper East Side': {
    name: 'Upper East Side',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7736, lng: -73.9566 },
    nearbyNeighborhoods: ['Upper West Side', 'Midtown East', 'Yorkville'],
  },
  'Upper West Side': {
    name: 'Upper West Side',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7870, lng: -73.9754 },
    nearbyNeighborhoods: ['Upper East Side', 'Midtown West', 'Morningside Heights'],
  },
  'Chelsea': {
    name: 'Chelsea',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7465, lng: -74.0014 },
    nearbyNeighborhoods: ['Hell\'s Kitchen', 'Greenwich Village', 'Midtown West'],
  },
  'Greenwich Village': {
    name: 'Greenwich Village',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7336, lng: -74.0027 },
    nearbyNeighborhoods: ['Chelsea', 'SoHo', 'East Village', 'West Village'],
  },
  'East Village': {
    name: 'East Village',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7264, lng: -73.9818 },
    nearbyNeighborhoods: ['Greenwich Village', 'Lower East Side', 'Gramercy'],
  },
  'SoHo': {
    name: 'SoHo',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7233, lng: -74.0030 },
    nearbyNeighborhoods: ['Greenwich Village', 'TriBeCa', 'Little Italy', 'Nolita'],
  },
  'Tribeca': {
    name: 'Tribeca',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7163, lng: -74.0086 },
    nearbyNeighborhoods: ['SoHo', 'Financial District', 'Chinatown'],
  },
  'Financial District': {
    name: 'Financial District',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7074, lng: -74.0113 },
    nearbyNeighborhoods: ['Tribeca', 'Battery Park City'],
  },
  'Midtown': {
    name: 'Midtown',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7549, lng: -73.9840 },
    nearbyNeighborhoods: ['Hell\'s Kitchen', 'Chelsea', 'Murray Hill'],
  },
  'Hell\'s Kitchen': {
    name: 'Hell\'s Kitchen',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7638, lng: -73.9918 },
    nearbyNeighborhoods: ['Midtown', 'Chelsea', 'Upper West Side'],
  },
  'West Village': {
    name: 'West Village',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7358, lng: -74.0036 },
    nearbyNeighborhoods: ['Greenwich Village', 'Chelsea', 'SoHo'],
  },
  'Lower East Side': {
    name: 'Lower East Side',
    city: 'New York',
    borough: 'Manhattan',
    state: 'NY',
    coordinates: { lat: 40.7150, lng: -73.9843 },
    nearbyNeighborhoods: ['East Village', 'Chinatown', 'Two Bridges'],
  },
  'Long Island City': {
    name: 'Long Island City',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7447, lng: -73.9485 },
    nearbyNeighborhoods: ['Astoria', 'Greenpoint', 'Sunnyside'],
  },
  'Astoria': {
    name: 'Astoria',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7648, lng: -73.9232 },
    nearbyNeighborhoods: ['Long Island City', 'Woodside', 'Sunnyside'],
  },
  'Flushing': {
    name: 'Flushing',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7675, lng: -73.8330 },
    nearbyNeighborhoods: ['Murray Hill', 'Bayside', 'College Point'],
  },
  'Forest Hills': {
    name: 'Forest Hills',
    city: 'New York',
    borough: 'Queens',
    state: 'NY',
    coordinates: { lat: 40.7185, lng: -73.8448 },
    nearbyNeighborhoods: ['Rego Park', 'Kew Gardens', 'Jamaica'],
  },
  'Riverdale': {
    name: 'Riverdale',
    city: 'New York',
    borough: 'Bronx',
    state: 'NY',
    coordinates: { lat: 40.8908, lng: -73.9057 },
    nearbyNeighborhoods: ['Kingsbridge', 'Fieldston', 'Spuyten Duyvil'],
  },
  'Fordham': {
    name: 'Fordham',
    city: 'New York',
    borough: 'Bronx',
    state: 'NY',
    coordinates: { lat: 40.8622, lng: -73.8977 },
    nearbyNeighborhoods: ['Bedford Park', 'Belmont', 'University Heights'],
  },
  'White Plains': {
    name: 'White Plains',
    city: 'White Plains',
    borough: 'Westchester',
    state: 'NY',
    coordinates: { lat: 40.0310, lng: -73.7629 },
    nearbyNeighborhoods: ['Scarsdale', 'Harrison', 'Greenburgh'],
  },
  'Yonkers': {
    name: 'Yonkers',
    city: 'Yonkers',
    borough: 'Westchester',
    state: 'NY',
    coordinates: { lat: 40.9312, lng: -73.8987 },
    nearbyNeighborhoods: ['Riverdale', 'Mount Vernon', 'Hastings-on-Hudson'],
  },

  'Hollywood': {
    name: 'Hollywood',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 33.9845, lng: -118.3287 },
    nearbyNeighborhoods: ['West Hollywood', 'Los Feliz', 'Silver Lake'],
  },
  'Silver Lake': {
    name: 'Silver Lake',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0869, lng: -118.2702 },
    nearbyNeighborhoods: ['Echo Park', 'Los Feliz', 'Hollywood'],
  },
  'Venice': {
    name: 'Venice',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 33.9850, lng: -118.4695 },
    nearbyNeighborhoods: ['Santa Monica', 'Marina del Rey', 'Mar Vista'],
  },
  'Santa Monica': {
    name: 'Santa Monica',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0195, lng: -118.4912 },
    nearbyNeighborhoods: ['Venice', 'Brentwood', 'Pacific Palisades'],
  },
  'Echo Park': {
    name: 'Echo Park',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0782, lng: -118.2606 },
    nearbyNeighborhoods: ['Silver Lake', 'Downtown LA', 'Elysian Park'],
  },
  'Downtown LA': {
    name: 'Downtown LA',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0407, lng: -118.2468 },
    nearbyNeighborhoods: ['Arts District', 'Echo Park', 'Koreatown'],
  },
  'West Hollywood': {
    name: 'West Hollywood',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0900, lng: -118.3617 },
    nearbyNeighborhoods: ['Hollywood', 'Beverly Hills', 'Fairfax'],
  },
  'Koreatown': {
    name: 'Koreatown',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0577, lng: -118.3005 },
    nearbyNeighborhoods: ['Downtown LA', 'Mid-Wilshire', 'Westlake'],
  },
  'Los Feliz': {
    name: 'Los Feliz',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.1063, lng: -118.2847 },
    nearbyNeighborhoods: ['Silver Lake', 'Hollywood', 'Atwater Village'],
  },
  'Arts District': {
    name: 'Arts District',
    city: 'Los Angeles',
    state: 'CA',
    coordinates: { lat: 34.0375, lng: -118.2324 },
    nearbyNeighborhoods: ['Downtown LA', 'Little Tokyo', 'Boyle Heights'],
  },

  'Lincoln Park': {
    name: 'Lincoln Park',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.9214, lng: -87.6513 },
    nearbyNeighborhoods: ['Lakeview', 'Old Town', 'Wicker Park'],
  },
  'Wicker Park': {
    name: 'Wicker Park',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.9088, lng: -87.6796 },
    nearbyNeighborhoods: ['Bucktown', 'Ukrainian Village', 'Lincoln Park'],
  },
  'Logan Square': {
    name: 'Logan Square',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.9234, lng: -87.7085 },
    nearbyNeighborhoods: ['Bucktown', 'Humboldt Park', 'Avondale'],
  },
  'Lakeview': {
    name: 'Lakeview',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.9434, lng: -87.6553 },
    nearbyNeighborhoods: ['Lincoln Park', 'Uptown', 'Roscoe Village'],
  },
  'Hyde Park': {
    name: 'Hyde Park',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.7943, lng: -87.5907 },
    nearbyNeighborhoods: ['Kenwood', 'Woodlawn', 'South Shore'],
  },
  'River North': {
    name: 'River North',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.8918, lng: -87.6338 },
    nearbyNeighborhoods: ['Streeterville', 'Old Town', 'The Loop'],
  },
  'The Loop': {
    name: 'The Loop',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.8819, lng: -87.6278 },
    nearbyNeighborhoods: ['River North', 'South Loop', 'West Loop'],
  },
  'West Loop': {
    name: 'West Loop',
    city: 'Chicago',
    state: 'IL',
    coordinates: { lat: 41.8826, lng: -87.6514 },
    nearbyNeighborhoods: ['The Loop', 'Greektown', 'Fulton Market'],
  },

  'South Beach': {
    name: 'South Beach',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7826, lng: -80.1340 },
    nearbyNeighborhoods: ['Mid-Beach', 'Downtown Miami', 'Fisher Island'],
  },
  'Brickell': {
    name: 'Brickell',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7589, lng: -80.1918 },
    nearbyNeighborhoods: ['Downtown Miami', 'Coconut Grove', 'Key Biscayne'],
  },
  'Wynwood': {
    name: 'Wynwood',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.8010, lng: -80.1990 },
    nearbyNeighborhoods: ['Midtown Miami', 'Design District', 'Edgewater'],
  },
  'Coconut Grove': {
    name: 'Coconut Grove',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7279, lng: -80.2384 },
    nearbyNeighborhoods: ['Brickell', 'Coral Gables', 'South Miami'],
  },
  'Coral Gables': {
    name: 'Coral Gables',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7215, lng: -80.2684 },
    nearbyNeighborhoods: ['Coconut Grove', 'South Miami', 'Pinecrest'],
  },
  'Downtown Miami': {
    name: 'Downtown Miami',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7751, lng: -80.1947 },
    nearbyNeighborhoods: ['Brickell', 'Wynwood', 'Overtown'],
  },
  'Little Havana': {
    name: 'Little Havana',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.7654, lng: -80.2198 },
    nearbyNeighborhoods: ['Downtown Miami', 'Coral Gables', 'Flagami'],
  },
  'Design District': {
    name: 'Design District',
    city: 'Miami',
    state: 'FL',
    coordinates: { lat: 25.8133, lng: -80.1928 },
    nearbyNeighborhoods: ['Wynwood', 'Midtown Miami', 'Upper East Side Miami'],
  },

  'Mission District': {
    name: 'Mission District',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7599, lng: -122.4148 },
    nearbyNeighborhoods: ['Castro', 'Noe Valley', 'Potrero Hill'],
  },
  'Castro': {
    name: 'Castro',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7609, lng: -122.4350 },
    nearbyNeighborhoods: ['Mission District', 'Noe Valley', 'Haight-Ashbury'],
  },
  'SOMA': {
    name: 'SOMA',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7785, lng: -122.3950 },
    nearbyNeighborhoods: ['Mission District', 'Financial District SF', 'South Beach SF'],
  },
  'Marina District': {
    name: 'Marina District',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.8024, lng: -122.4368 },
    nearbyNeighborhoods: ['Pacific Heights SF', 'Cow Hollow', 'Presidio'],
  },
  'Haight-Ashbury': {
    name: 'Haight-Ashbury',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7692, lng: -122.4481 },
    nearbyNeighborhoods: ['Castro', 'Cole Valley', 'Lower Haight'],
  },
  'Noe Valley': {
    name: 'Noe Valley',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7502, lng: -122.4333 },
    nearbyNeighborhoods: ['Castro', 'Mission District', 'Glen Park'],
  },
  'North Beach SF': {
    name: 'North Beach SF',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.8060, lng: -122.4103 },
    nearbyNeighborhoods: ['Chinatown SF', 'Telegraph Hill', 'Russian Hill'],
  },
  'Pacific Heights SF': {
    name: 'Pacific Heights SF',
    city: 'San Francisco',
    state: 'CA',
    coordinates: { lat: 37.7925, lng: -122.4351 },
    nearbyNeighborhoods: ['Marina District', 'Japantown', 'Lower Pacific Heights'],
  },

  'East Austin': {
    name: 'East Austin',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.2600, lng: -97.7200 },
    nearbyNeighborhoods: ['Downtown Austin', 'South Congress', 'Mueller'],
  },
  'Downtown Austin': {
    name: 'Downtown Austin',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.2672, lng: -97.7431 },
    nearbyNeighborhoods: ['East Austin', 'South Congress', 'Rainey Street'],
  },
  'South Congress': {
    name: 'South Congress',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.2455, lng: -97.7494 },
    nearbyNeighborhoods: ['Downtown Austin', 'Travis Heights', 'Zilker'],
  },
  'Zilker': {
    name: 'Zilker',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.2630, lng: -97.7710 },
    nearbyNeighborhoods: ['South Congress', 'Barton Hills', 'Downtown Austin'],
  },
  'Hyde Park Austin': {
    name: 'Hyde Park Austin',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.3050, lng: -97.7286 },
    nearbyNeighborhoods: ['North Loop', 'University of Texas', 'Hancock'],
  },
  'Mueller': {
    name: 'Mueller',
    city: 'Austin',
    state: 'TX',
    coordinates: { lat: 30.2969, lng: -97.7051 },
    nearbyNeighborhoods: ['East Austin', 'Windsor Park', 'University Hills'],
  },

  'Capitol Hill Seattle': {
    name: 'Capitol Hill Seattle',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6253, lng: -122.3222 },
    nearbyNeighborhoods: ['First Hill', 'Central District', 'Madison Valley'],
  },
  'Ballard': {
    name: 'Ballard',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6686, lng: -122.3845 },
    nearbyNeighborhoods: ['Fremont', 'Crown Hill', 'Phinney Ridge'],
  },
  'Fremont': {
    name: 'Fremont',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6519, lng: -122.3506 },
    nearbyNeighborhoods: ['Ballard', 'Wallingford', 'Queen Anne'],
  },
  'Queen Anne': {
    name: 'Queen Anne',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6374, lng: -122.3571 },
    nearbyNeighborhoods: ['South Lake Union', 'Fremont', 'Belltown'],
  },
  'South Lake Union': {
    name: 'South Lake Union',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6269, lng: -122.3389 },
    nearbyNeighborhoods: ['Capitol Hill Seattle', 'Queen Anne', 'Downtown Seattle'],
  },
  'Belltown': {
    name: 'Belltown',
    city: 'Seattle',
    state: 'WA',
    coordinates: { lat: 47.6150, lng: -122.3482 },
    nearbyNeighborhoods: ['Downtown Seattle', 'Queen Anne', 'Pike Place'],
  },

  'LoDo': {
    name: 'LoDo',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.7536, lng: -104.9989 },
    nearbyNeighborhoods: ['RiNo', 'Capitol Hill Denver', 'Five Points'],
  },
  'RiNo': {
    name: 'RiNo',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.7674, lng: -104.9811 },
    nearbyNeighborhoods: ['LoDo', 'Five Points', 'Cole'],
  },
  'Capitol Hill Denver': {
    name: 'Capitol Hill Denver',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.7318, lng: -104.9783 },
    nearbyNeighborhoods: ['Cheesman Park', 'City Park West', 'Congress Park'],
  },
  'Cherry Creek': {
    name: 'Cherry Creek',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.7177, lng: -104.9558 },
    nearbyNeighborhoods: ['Washington Park', 'Glendale', 'Hilltop'],
  },
  'Washington Park': {
    name: 'Washington Park',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.6992, lng: -104.9727 },
    nearbyNeighborhoods: ['Cherry Creek', 'Platt Park', 'South Broadway'],
  },
  'Five Points': {
    name: 'Five Points',
    city: 'Denver',
    state: 'CO',
    coordinates: { lat: 39.7558, lng: -104.9740 },
    nearbyNeighborhoods: ['RiNo', 'LoDo', 'City Park West'],
  },

  'Back Bay': {
    name: 'Back Bay',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3503, lng: -71.0810 },
    nearbyNeighborhoods: ['South End', 'Fenway', 'Beacon Hill'],
  },
  'South End': {
    name: 'South End',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3388, lng: -71.0764 },
    nearbyNeighborhoods: ['Back Bay', 'Roxbury', 'South Boston'],
  },
  'Cambridge': {
    name: 'Cambridge',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3736, lng: -71.1097 },
    nearbyNeighborhoods: ['Somerville', 'Allston', 'Beacon Hill'],
  },
  'Beacon Hill': {
    name: 'Beacon Hill',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3588, lng: -71.0707 },
    nearbyNeighborhoods: ['Back Bay', 'Downtown Boston', 'West End'],
  },
  'South Boston': {
    name: 'South Boston',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3381, lng: -71.0476 },
    nearbyNeighborhoods: ['South End', 'Downtown Boston', 'Dorchester'],
  },
  'Fenway': {
    name: 'Fenway',
    city: 'Boston',
    state: 'MA',
    coordinates: { lat: 42.3467, lng: -71.0972 },
    nearbyNeighborhoods: ['Back Bay', 'Brookline', 'Mission Hill'],
  },

  'Midtown Houston': {
    name: 'Midtown Houston',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7406, lng: -95.3828 },
    nearbyNeighborhoods: ['Montrose', 'Downtown Houston', 'Museum District'],
  },
  'Montrose': {
    name: 'Montrose',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7454, lng: -95.3949 },
    nearbyNeighborhoods: ['Midtown Houston', 'River Oaks', 'Museum District'],
  },
  'The Heights Houston': {
    name: 'The Heights Houston',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7902, lng: -95.3987 },
    nearbyNeighborhoods: ['Midtown Houston', 'Garden Oaks', 'Near Northside'],
  },
  'Museum District': {
    name: 'Museum District',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7224, lng: -95.3892 },
    nearbyNeighborhoods: ['Montrose', 'Rice Village', 'Medical Center'],
  },
  'Rice Village': {
    name: 'Rice Village',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7168, lng: -95.4131 },
    nearbyNeighborhoods: ['Museum District', 'West University', 'Medical Center'],
  },
  'EaDo': {
    name: 'EaDo',
    city: 'Houston',
    state: 'TX',
    coordinates: { lat: 29.7499, lng: -95.3550 },
    nearbyNeighborhoods: ['Downtown Houston', 'East End', 'Second Ward'],
  },

  'Midtown Atlanta': {
    name: 'Midtown Atlanta',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.7837, lng: -84.3831 },
    nearbyNeighborhoods: ['Virginia-Highland', 'Old Fourth Ward', 'Buckhead'],
  },
  'Buckhead': {
    name: 'Buckhead',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.8388, lng: -84.3796 },
    nearbyNeighborhoods: ['Midtown Atlanta', 'Brookhaven', 'Sandy Springs'],
  },
  'Virginia-Highland': {
    name: 'Virginia-Highland',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.7873, lng: -84.3560 },
    nearbyNeighborhoods: ['Midtown Atlanta', 'Poncey-Highland', 'Druid Hills'],
  },
  'Old Fourth Ward': {
    name: 'Old Fourth Ward',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.7685, lng: -84.3635 },
    nearbyNeighborhoods: ['Midtown Atlanta', 'Inman Park', 'Sweet Auburn'],
  },
  'Inman Park': {
    name: 'Inman Park',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.7611, lng: -84.3522 },
    nearbyNeighborhoods: ['Old Fourth Ward', 'Little Five Points', 'Candler Park'],
  },
  'Decatur': {
    name: 'Decatur',
    city: 'Atlanta',
    state: 'GA',
    coordinates: { lat: 33.7748, lng: -84.2963 },
    nearbyNeighborhoods: ['Druid Hills', 'Oakhurst', 'Avondale Estates'],
  },
};

export const CITY_SUB_AREAS: Record<string, { label: string; areas: string[] }> = {
  'New York': {
    label: 'Borough',
    areas: ['Manhattan', 'Brooklyn', 'Queens', 'Bronx'],
  },
  'Los Angeles': {
    label: 'Area',
    areas: ['Westside', 'Hollywood/Central', 'Eastside', 'Downtown'],
  },
  'Chicago': {
    label: 'Side',
    areas: ['North Side', 'South Side', 'West Side', 'Downtown/Loop'],
  },
  'Houston': {
    label: 'Area',
    areas: ['Inner Loop', 'Midtown/Montrose', 'The Heights'],
  },
  'Miami': {
    label: 'Area',
    areas: ['Beach', 'Downtown/Brickell', 'Design/Wynwood', 'Coral Gables/Grove'],
  },
};

const LA_AREA_MAP: Record<string, string[]> = {
  'Westside': ['Venice', 'Santa Monica', 'West Hollywood'],
  'Hollywood/Central': ['Hollywood', 'Los Feliz', 'Koreatown'],
  'Eastside': ['Silver Lake', 'Echo Park', 'Arts District'],
  'Downtown': ['Downtown LA'],
};

const CHICAGO_AREA_MAP: Record<string, string[]> = {
  'North Side': ['Lincoln Park', 'Wicker Park', 'Logan Square', 'Lakeview'],
  'South Side': ['Hyde Park'],
  'West Side': ['West Loop'],
  'Downtown/Loop': ['The Loop', 'River North'],
};

const HOUSTON_AREA_MAP: Record<string, string[]> = {
  'Inner Loop': ['Downtown Houston', 'EaDo'],
  'Midtown/Montrose': ['Midtown Houston', 'Montrose', 'Museum District', 'Rice Village'],
  'The Heights': ['The Heights Houston'],
};

const MIAMI_AREA_MAP: Record<string, string[]> = {
  'Beach': ['South Beach'],
  'Downtown/Brickell': ['Downtown Miami', 'Brickell'],
  'Design/Wynwood': ['Wynwood', 'Design District'],
  'Coral Gables/Grove': ['Coconut Grove', 'Coral Gables', 'Little Havana'],
};

export function getSubAreasForCity(city: string): string[] | null {
  return CITY_SUB_AREAS[city]?.areas || null;
}

export function getSubAreaLabel(city: string): string {
  return CITY_SUB_AREAS[city]?.label || 'Area';
}

export function getNeighborhoodsBySubArea(city: string, subArea: string): string[] {
  if (city === 'New York') {
    return Object.keys(NEIGHBORHOODS).filter(
      n => NEIGHBORHOODS[n].city === city && NEIGHBORHOODS[n].borough === subArea
    );
  }
  if (city === 'Los Angeles') return LA_AREA_MAP[subArea] || [];
  if (city === 'Chicago') return CHICAGO_AREA_MAP[subArea] || [];
  if (city === 'Houston') return HOUSTON_AREA_MAP[subArea] || [];
  if (city === 'Miami') return MIAMI_AREA_MAP[subArea] || [];
  return [];
}

export function getCityFromNeighborhood(neighborhood: string): string | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.city : null;
}

export function getStateFromNeighborhood(neighborhood: string): string | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.state : null;
}

export function getCoordinatesFromNeighborhood(neighborhood: string): { lat: number; lng: number } | null {
  const neighborhoodData = NEIGHBORHOODS[neighborhood];
  return neighborhoodData ? neighborhoodData.coordinates : null;
}

export function isNearbyNeighborhood(neighborhood1: string, neighborhood2: string): boolean {
  const n1Data = NEIGHBORHOODS[neighborhood1];
  const n2Data = NEIGHBORHOODS[neighborhood2];

  if (!n1Data || !n2Data) return false;

  return n1Data.nearbyNeighborhoods?.includes(neighborhood2) || false;
}

export function isSameCity(neighborhood1: string, neighborhood2: string): boolean {
  const city1 = getCityFromNeighborhood(neighborhood1);
  const city2 = getCityFromNeighborhood(neighborhood2);

  if (!city1 || !city2) return false;

  return city1 === city2;
}

export function getBoroughsByCity(city: string): string[] {
  const boroughs = new Set<string>();
  Object.values(NEIGHBORHOODS).forEach(n => {
    if (n.city === city && n.borough) boroughs.add(n.borough);
  });
  return Array.from(boroughs).sort();
}

export function getNeighborhoodsByBorough(city: string, borough: string): string[] {
  return Object.keys(NEIGHBORHOODS).filter(
    n => NEIGHBORHOODS[n].city === city && NEIGHBORHOODS[n].borough === borough
  );
}

export function getNeighborhoodsByCity(city: string): string[] {
  return Object.keys(NEIGHBORHOODS).filter(
    neighborhood => NEIGHBORHOODS[neighborhood].city === city
  );
}

export function getAllCities(): string[] {
  const cities = new Set<string>();
  Object.values(NEIGHBORHOODS).forEach(n => cities.add(n.city));
  return Array.from(cities).sort();
}

export function getAllStates(): string[] {
  const states = new Set<string>();
  Object.values(NEIGHBORHOODS).forEach(n => states.add(n.state));
  return Array.from(states).sort();
}

export function getCitiesByState(stateCode: string): string[] {
  const cities = new Set<string>();
  Object.values(NEIGHBORHOODS).forEach(n => {
    if (n.state === stateCode) cities.add(n.city);
  });
  return Array.from(cities).sort();
}

export function getStateNameFromCode(code: string): string {
  const state = US_STATES.find(s => s.code === code);
  return state ? state.name : code;
}

export function getStatesWithData(): { code: string; name: string }[] {
  const statesWithData = getAllStates();
  return US_STATES.filter(s => statesWithData.includes(s.code));
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  return calculateDistance(lat1, lng1, lat2, lng2);
}

export function getNeighborhoodDistance(name1: string, name2: string): number | null {
  const n1 = NEIGHBORHOODS[name1];
  const n2 = NEIGHBORHOODS[name2];
  if (!n1?.coordinates || !n2?.coordinates) return null;
  return haversineDistanceMiles(
    n1.coordinates.lat, n1.coordinates.lng,
    n2.coordinates.lat, n2.coordinates.lng
  );
}

export function getClosestNeighborhoodDistance(
  neighborhoodsA: string[],
  neighborhoodsB: string[]
): { distance: number; pairA: string; pairB: string } | null {
  let closest: { distance: number; pairA: string; pairB: string } | null = null;

  for (const a of neighborhoodsA) {
    for (const b of neighborhoodsB) {
      const dist = getNeighborhoodDistance(a, b);
      if (dist !== null && (closest === null || dist < closest.distance)) {
        closest = { distance: dist, pairA: a, pairB: b };
      }
    }
  }
  return closest;
}

let zipCache: Record<string, { lat: number; lng: number }> = {};

export function setZipCodeCache(data: Record<string, { lat: number; lng: number }>) {
  zipCache = data;
}

export function getZipCodeDistance(zip1: string, zip2: string): number | null {
  const c1 = zipCache[zip1];
  const c2 = zipCache[zip2];
  if (!c1 || !c2) return null;
  return haversineDistanceMiles(c1.lat, c1.lng, c2.lat, c2.lng);
}
