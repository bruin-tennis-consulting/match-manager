import { useState, useEffect } from 'react';
import { getLogoFromCache, setLogoInCache } from '@/app/services/logoCache';
import getTeams from '@/app/services/getTeams';

const normalizeTeamName = (name) => {
  if (!name) return '';
  return name
    .replace('University of', '')
    .replace('University', '')
    .replace('(M)', '(M)')
    .replace('(W)', '(W)')
    .trim();
};

export const useTeamLogos = (clientTeam, opponentTeam) => {
  const [clientLogo, setClientLogo] = useState('');
  const [opponentLogo, setOpponentLogo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        setLoading(true);
        
        const normalizedClientTeam = normalizeTeamName(clientTeam);
        const normalizedOpponentTeam = normalizeTeamName(opponentTeam);

        // Check cache first
        const cachedClientLogo = getLogoFromCache(normalizedClientTeam);
        const cachedOpponentLogo = getLogoFromCache(normalizedOpponentTeam);

        if (cachedClientLogo && cachedOpponentLogo) {
          setClientLogo(cachedClientLogo);
          setOpponentLogo(cachedOpponentLogo);
          setLoading(false);
          return;
        }

        // If not in cache, fetch from database
        const allTeams = await getTeams();
        const clientTeamData = allTeams.find(team => 
          normalizeTeamName(team.name) === normalizedClientTeam
        );
        const opponentTeamData = allTeams.find(team => 
          normalizeTeamName(team.name) === normalizedOpponentTeam
        );

        if (clientTeamData) {
          setClientLogo(clientTeamData.logoUrl);
          setLogoInCache(normalizedClientTeam, clientTeamData.logoUrl);
        }
        if (opponentTeamData) {
          setOpponentLogo(opponentTeamData.logoUrl);
          setLogoInCache(normalizedOpponentTeam, opponentTeamData.logoUrl);
        }
      } catch (error) {
        console.error('Error fetching logos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogos();
  }, [clientTeam, opponentTeam]);

  return { clientLogo, opponentLogo, loading };
}; 