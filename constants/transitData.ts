export const NYC_TRAIN_NEIGHBORHOODS: Record<string, string[]> = {
  'L': [
    'Williamsburg', 'Bushwick', 'East New York', 'Canarsie',
    'Ridgewood', 'Myrtle-Wyckoff'
  ],
  'G': [
    'Greenpoint', 'Williamsburg', 'Bed-Stuy', 'Carroll Gardens',
    'Park Slope', 'Astoria', 'Long Island City'
  ],
  'A': [
    'Washington Heights', 'Harlem', "Hell's Kitchen", 'Lower Manhattan',
    'Howard Beach', 'Far Rockaway', 'Ozone Park', 'Bed-Stuy'
  ],
  'C': [
    'Washington Heights', 'Harlem', 'Upper West Side',
    "Hell's Kitchen", 'Lower Manhattan', 'Clinton Hill', 'Bedford-Stuyvesant'
  ],
  'E': [
    'Jackson Heights', 'Woodside', "Hell's Kitchen",
    'Midtown', 'Lower Manhattan', 'Jamaica'
  ],
  '1': [
    'Washington Heights', 'Inwood', 'Harlem', 'Morningside Heights',
    'Upper West Side', 'Chelsea', 'Tribeca', 'Lower Manhattan'
  ],
  '2': [
    'Wakefield', 'Bronx', 'Harlem', 'Upper West Side',
    'Flatbush', 'Crown Heights', 'East Flatbush'
  ],
  '3': [
    'Harlem', 'Upper West Side', 'Chelsea', 'Lower Manhattan',
    'Crown Heights', 'Bed-Stuy', 'Brownsville', 'East New York'
  ],
  '4': [
    'Woodlawn', 'Bronx', 'Upper East Side', 'Midtown East',
    'Lower Manhattan', 'Crown Heights', 'Flatbush', 'Utica'
  ],
  '5': [
    'Bronx', 'Harlem', 'Upper East Side', 'Midtown East',
    'Lower Manhattan', 'Crown Heights', 'East Flatbush'
  ],
  '6': [
    'Pelham Bay', 'Bronx', 'Upper East Side', 'Midtown East',
    'Lower Manhattan', 'Hunts Point'
  ],
  'N': [
    'Astoria', 'Midtown', 'Lower Manhattan', 'Bay Ridge',
    'Bensonhurst', 'Coney Island', 'Sunset Park'
  ],
  'Q': [
    'Astoria', 'Midtown', 'Lower Manhattan', 'Park Slope',
    'Flatbush', 'Brighton Beach', 'Coney Island'
  ],
  'R': [
    'Astoria', 'Midtown', 'Lower Manhattan', 'Bay Ridge',
    'Sunset Park', 'Park Slope', 'Forest Hills'
  ],
  'W': [
    'Astoria', 'Midtown', 'Lower Manhattan'
  ],
  'B': [
    'Washington Heights', 'Harlem', 'Upper West Side', 'Midtown',
    'Prospect Park', 'Flatbush', 'Brighton Beach', 'Coney Island'
  ],
  'D': [
    'Norwood', 'Bronx', 'Harlem', 'Midtown', 'Sunset Park',
    'Bensonhurst', 'Coney Island', 'Grand Concourse'
  ],
  'F': [
    'Jackson Heights', 'Midtown', 'Lower Manhattan', 'Park Slope',
    'Carroll Gardens', 'Gowanus', 'Ditmas Park', 'Coney Island', 'Forest Hills'
  ],
  'M': [
    'Forest Hills', 'Middle Village', 'Ridgewood', 'Bushwick',
    'Williamsburg', 'Lower Manhattan', 'Midtown'
  ],
  'J': [
    'Jamaica', 'Woodhaven', 'Bushwick', 'Bed-Stuy',
    'Lower East Side', 'Lower Manhattan'
  ],
  'Z': [
    'Jamaica', 'Woodhaven', 'Bushwick', 'Lower Manhattan'
  ],
  '7': [
    'Flushing', 'Jackson Heights', 'Woodside', 'Long Island City',
    'Hudson Yards', 'Midtown'
  ],
  'PATH': [
    'Jersey City', 'Hoboken', 'Newark', 'Harrison',
    'Journal Square', 'Grove Street'
  ],
};

export const NEIGHBORHOOD_TRAINS: Record<string, string[]> = {
  'Williamsburg':       ['L', 'G', 'J', 'M', 'Z'],
  'Bushwick':           ['L', 'M', 'J', 'Z'],
  'Greenpoint':         ['G'],
  'Astoria':            ['N', 'Q', 'R', 'W', 'G'],
  'Long Island City':   ['7', 'G', 'E', 'M'],
  'Jackson Heights':    ['7', 'E', 'F', 'M', 'R'],
  'Crown Heights':      ['2', '3', '4', '5', 'A', 'C'],
  'Harlem':             ['2', '3', 'A', 'B', 'C', 'D', '4', '5', '6'],
  'Washington Heights': ['1', 'A', 'C'],
  'Upper West Side':    ['1', '2', '3', 'B', 'C'],
  'Upper East Side':    ['4', '5', '6', 'Q'],
  "Hell's Kitchen":     ['A', 'C', 'E', '1', 'N', 'Q', 'R'],
  'Park Slope':         ['F', 'G', 'R', 'B', 'Q', '2', '3'],
  'Bed-Stuy':           ['A', 'C', 'G', 'J', 'Z', '3'],
  'Carroll Gardens':    ['F', 'G'],
  'Flatbush':           ['B', 'Q', '2', '5'],
  'Midtown':            ['1','2','3','4','5','6','7','A','C','E','B','D','F','M','N','Q','R','W'],
  'Lower Manhattan':    ['1','2','3','4','5','A','C','E','J','Z','N','Q','R','W','B','D','F'],
  'Forest Hills':       ['E', 'F', 'M', 'R'],
  'Flushing':           ['7'],
  'Woodside':           ['7'],
  'Bronx':              ['2','4','5','6','B','D'],
};

export const BOROUGH_NEIGHBORHOODS: Record<string, string[]> = {
  'Brooklyn': [
    'Williamsburg', 'Bushwick', 'Greenpoint', 'Park Slope',
    'Crown Heights', 'Bed-Stuy', 'Carroll Gardens', 'Flatbush',
    'Bay Ridge', 'Sunset Park', 'Bensonhurst', 'Coney Island',
    'Brighton Beach', 'Prospect Park', 'Gowanus', 'Ditmas Park',
    'Clinton Hill', 'Bedford-Stuyvesant', 'Brownsville', 'East New York',
    'East Flatbush', 'Canarsie'
  ],
  'Manhattan': [
    'Harlem', 'Washington Heights', "Hell's Kitchen", 'Upper West Side',
    'Upper East Side', 'Midtown', 'Midtown East', 'Chelsea', 'Tribeca',
    'Lower Manhattan', 'Lower East Side', 'East Village', 'Morningside Heights',
    'Inwood', 'Hudson Yards'
  ],
  'Queens': [
    'Astoria', 'Long Island City', 'Jackson Heights', 'Flushing',
    'Woodside', 'Forest Hills', 'Jamaica', 'Woodhaven',
    'Middle Village', 'Ridgewood', 'Howard Beach', 'Ozone Park'
  ],
  'Bronx': [
    'Bronx', 'Riverdale', 'Fordham', 'Mott Haven',
    'Woodlawn', 'Wakefield', 'Pelham Bay', 'Hunts Point',
    'Norwood', 'Grand Concourse'
  ],
  'New Jersey': [
    'Jersey City', 'Hoboken', 'Newark', 'Harrison',
    'Journal Square', 'Grove Street'
  ],
};

export const SUBWAY_LINES = [
  'A', 'C', 'E',
  '1', '2', '3',
  '4', '5', '6',
  'L', 'G', '7',
  'N', 'Q', 'R', 'W',
  'B', 'D', 'F', 'M',
  'J', 'Z',
  'S',
];

export const OTHER_TRANSIT = ['PATH', 'LIRR', 'Metro-North'];

export const SUBWAY_LINE_COLORS: Record<string, string> = {
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C',
  'L': '#A7A9AC', 'G': '#6CBE45', '7': '#B933AD',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'J': '#996633', 'Z': '#996633',
  'S': '#808183',
  'PATH': '#004D6F',
  'LIRR': '#0D5EA7',
  'Metro-North': '#007E5B',
};

export function findCompatibleNeighborhoods(trainLines: string[]): string[] {
  if (!trainLines || trainLines.length === 0) return [];

  return Object.entries(NEIGHBORHOOD_TRAINS)
    .filter(([_neighborhood, trains]) =>
      trainLines.every(line =>
        trains.includes(line) ||
        hasReasonableTransfer(line, trains)
      )
    )
    .map(([neighborhood]) => neighborhood);
}

export function hasReasonableTransfer(line: string, neighborhoodTrains: string[]): boolean {
  const transferHubs: Record<string, string[]> = {
    'L': ['G', 'J', 'M', 'Z'],
    'G': ['L', 'F', 'R', 'A', 'C'],
    'A': ['C', 'E', '1', '2', '3'],
    'C': ['A', 'E', '1', 'B', 'D'],
    'E': ['A', 'C', 'M', 'R', '7'],
    '1': ['2', '3', 'A', 'C'],
    '2': ['1', '3', '4', '5'],
    '3': ['1', '2', '4', '5'],
    '4': ['5', '6', 'N', 'Q', 'R'],
    '5': ['4', '6', '2', '3'],
    '6': ['4', '5', 'N', 'Q', 'R'],
    '7': ['E', 'F', 'M', 'R', 'N', 'Q', 'W'],
    'N': ['Q', 'R', 'W', '4', '5', '6'],
    'Q': ['N', 'R', 'W', 'B', 'D'],
    'R': ['N', 'Q', 'W', 'F', 'M'],
    'W': ['N', 'Q', 'R'],
    'B': ['D', 'F', 'M', 'Q'],
    'D': ['B', 'F', 'M', 'N'],
    'F': ['B', 'D', 'M', 'G', 'R'],
    'M': ['B', 'D', 'F', 'L', 'J', 'Z'],
    'J': ['Z', 'M', 'L'],
    'Z': ['J', 'M'],
  };
  const transfers = transferHubs[line] ?? [];
  return transfers.some(t => neighborhoodTrains.includes(t));
}

export function getNeighborhoodTrains(neighborhood: string): string[] {
  return NEIGHBORHOOD_TRAINS[neighborhood] ?? [];
}

export function getTrainNeighborhoods(trainLine: string): string[] {
  return NYC_TRAIN_NEIGHBORHOODS[trainLine] ?? [];
}
