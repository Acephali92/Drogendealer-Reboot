import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { qk, useCities, useInventory, useMe, useTravel } from '@/api/queries';
import { toast } from '@/stores/toast';

/** Gemeinsamer Spielkontext: Spieler, aktuelle Stadt, Reise, Laderaum. */
export function useGame() {
  const me = useMe();
  const cities = useCities();
  const inventory = useInventory();
  const player = me.data;
  const traveling = player?.status === 'TRAVELING';
  const travel = useTravel(!!player && traveling);
  const cityById = (id: string | null | undefined) => cities.data?.find((c) => c.id === id) ?? null;
  const city = cityById(player?.currentCityId);
  const destination = traveling ? cityById(travel.data?.toCityId) : null;
  /** Laderaum in Volumeneinheiten: Rucksack + aktives Fahrzeug (T-119) */
  const cargo = inventory.data
    ? {
        used: inventory.data.used,
        capacity: inventory.data.capacity,
        free: Math.max(0, inventory.data.capacity - inventory.data.used),
      }
    : null;
  return {
    me,
    player,
    cities,
    city,
    cityById,
    traveling,
    travel: travel.data ?? null,
    destination,
    inventory,
    cargo,
  };
}

/** Nach Ankunft (Countdown abgelaufen) Spielerzustand neu laden. */
export function useArrivalRefresh() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useCallback(
    async (cityName?: string) => {
      await new Promise((r) => setTimeout(r, 400));
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.me }),
        qc.invalidateQueries({ queryKey: qk.travel }),
        qc.invalidateQueries({ queryKey: qk.notifications }),
        qc.invalidateQueries({ queryKey: qk.ticker }),
        qc.invalidateQueries({ queryKey: ['cities'] }),
      ]);
      if (cityName) toast.success(t('travel.arrived', { city: cityName }));
    },
    [qc, t],
  );
}
