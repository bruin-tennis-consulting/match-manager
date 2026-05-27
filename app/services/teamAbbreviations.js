export const TEAM_ABBREVIATIONS = {
  'University of California, Los Angeles': 'UCLA',
  'University of California, Berkeley': 'Cal',
  'University of California, Santa Barbara': 'UC Santa Barbara',
  'University of California, San Diego': 'UCSD',
  'University of California, Irvine': 'UC Irvine',
  'University of California, Riverside': 'UC Riverside',
  'University of California, Davis': 'UC Davis',
  'University of Southern California': 'USC',
  'University of Nevada, Las Vegas': 'UNLV',
  'University of Nevada': 'Nevada',
  'Stanford University': 'Stanford',
  'Arizona State University': 'Arizona State',
  'University of Arizona': 'Arizona',
  'University of Oregon': 'Oregon',
  'Oregon State University': 'Oregon State',
  'University of Washington': 'Washington',
  'Washington State University': 'Washington State',
  'University of Utah': 'Utah',
  'University of Colorado': 'Colorado',
  'Brigham Young University': 'BYU',
  'University of Hawaii': 'Hawaii',
  'Pepperdine University': 'Pepperdine',
  'Loyola Marymount University': 'LMU',
  'University of San Diego': 'USD',
  'San Diego State University': 'SDSU',
  'Cal Poly San Luis Obispo': 'Cal Poly SLO',
  'California State University, Long Beach': 'Long Beach State',
  'California State University, Fullerton': 'Cal State Fullerton',
  'California State University, Northridge': 'CSUN',
  'California State University, Bakersfield': 'CSUB',
  'University of the Pacific': 'Pacific',
  'University of San Francisco': 'USF',
  'University of New Mexico': 'New Mexico',
  'Texas Christian University': 'TCU',
  'University of Texas': 'Texas',
  'Texas A&M University': 'Texas A&M',
  'University of Florida': 'Florida',
  'University of Georgia': 'Georgia',
  'Vanderbilt University': 'Vanderbilt',
  'University of North Carolina': 'UNC',
  'Duke University': 'Duke',
  'University of Virginia': 'Virginia',
  'Wake Forest University': 'Wake Forest',
  'University of Notre Dame': 'Notre Dame',
  'University of Michigan': 'Michigan',
  'Ohio State University': 'Ohio State',
  'Northwestern University': 'Northwestern',
  'Harvard University': 'Harvard',
  'Yale University': 'Yale',
  'Princeton University': 'Princeton'
  // Add more as needed
}

/**
 * Returns the display abbreviation for a team name.
 * Strips gender suffix (M)/(W) first, then looks up in map.
 * Falls back to the cleaned name if no mapping exists.
 */
export const getTeamAbbreviation = (teamName) => {
  if (!teamName) return teamName
  const cleaned = teamName.replace(/(\s*\([MmWw]\))+\s*$/, '').trim()
  return TEAM_ABBREVIATIONS[cleaned] ?? cleaned
}
