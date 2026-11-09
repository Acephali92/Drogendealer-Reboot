import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/stores/auth';
import {
  clanApi,
  equipmentApi,
  notificationApi,
  playerApi,
  rankingApi,
  tradeApi,
  travelApi,
  vehicleApi,
  worldApi,
} from './endpoints';
import type { RankingType, TradeSide } from './types';

/** Zentrale Query-Keys – Invalidierungen laufen nur hierüber. */
export const qk = {
  me: ['me'] as const,
  transactions: ['me', 'transactions'] as const,
  online: ['online'] as const,
  cities: ['cities'] as const,
  city: (slug: string) => ['cities', slug] as const,
  market: (slug: string) => ['market', slug] as const,
  overview: ['market', 'overview'] as const,
  ticker: ['ticker'] as const,
  inventory: ['inventory'] as const,
  vehicleTypes: ['vehicle-types'] as const,
  vehicles: ['vehicles'] as const,
  equipmentTypes: ['equipment-types'] as const,
  equipment: ['equipment'] as const,
  travel: ['travel'] as const,
  clans: ['clans'] as const,
  clan: (id: string) => ['clans', id] as const,
  invites: ['clan-invites'] as const,
  rankings: (t: RankingType) => ['rankings', t] as const,
  notifications: ['notifications'] as const,
};

/** Polling-Intervalle (kein WebSocket im Backend, siehe API-CONTRACT.md → Echtzeit). */
export const POLL = { player: 15_000, market: 30_000, feed: 20_000 };

const useAuthed = () => useAuth((s) => !!s.refreshToken);

export function useMe() {
  const enabled = useAuthed();
  return useQuery({ queryKey: qk.me, queryFn: playerApi.me, enabled, refetchInterval: POLL.player });
}

export const useTransactions = () => useQuery({ queryKey: qk.transactions, queryFn: playerApi.transactions });
export const useOnline = () =>
  useQuery({ queryKey: qk.online, queryFn: playerApi.online, refetchInterval: 60_000 });

export const useCities = () => useQuery({ queryKey: qk.cities, queryFn: worldApi.cities, staleTime: 10 * 60_000 });

export function useCity(slug: string | undefined) {
  return useQuery({ queryKey: qk.city(slug ?? ''), queryFn: () => worldApi.city(slug!), enabled: !!slug });
}

export function useMarket(slug: string | undefined) {
  return useQuery({
    queryKey: qk.market(slug ?? ''),
    queryFn: () => worldApi.market(slug!),
    enabled: !!slug,
    refetchInterval: POLL.market,
  });
}

export const useOverview = () =>
  useQuery({ queryKey: qk.overview, queryFn: worldApi.overview, refetchInterval: POLL.market });

export function useTicker() {
  const enabled = useAuthed();
  return useQuery({ queryKey: qk.ticker, queryFn: worldApi.ticker, enabled, refetchInterval: POLL.feed });
}

export const useInventory = () => useQuery({ queryKey: qk.inventory, queryFn: tradeApi.inventory });
export const useVehicleTypes = () =>
  useQuery({ queryKey: qk.vehicleTypes, queryFn: vehicleApi.types, staleTime: 10 * 60_000 });
export const useVehicles = () => useQuery({ queryKey: qk.vehicles, queryFn: vehicleApi.mine });
export const useEquipmentTypes = () =>
  useQuery({ queryKey: qk.equipmentTypes, queryFn: equipmentApi.types, staleTime: 10 * 60_000 });
export const useEquipment = () => useQuery({ queryKey: qk.equipment, queryFn: equipmentApi.mine });

export function useTravel(enabled = true) {
  return useQuery({ queryKey: qk.travel, queryFn: travelApi.current, enabled, refetchInterval: POLL.player });
}

export const useClans = () => useQuery({ queryKey: qk.clans, queryFn: clanApi.list });
export const useClan = (id: string | null | undefined) =>
  useQuery({ queryKey: qk.clan(id ?? ''), queryFn: () => clanApi.get(id!), enabled: !!id });
export const useInvites = () => useQuery({ queryKey: qk.invites, queryFn: clanApi.invites });
export const useRanking = (t: RankingType) => useQuery({ queryKey: qk.rankings(t), queryFn: () => rankingApi.get(t) });

export function useNotifications() {
  const enabled = useAuthed();
  return useQuery({
    queryKey: qk.notifications,
    queryFn: notificationApi.list,
    enabled,
    refetchInterval: POLL.feed,
  });
}

/* ---------------------------------------------------------------- Mutationen */

export function useTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { cityId: string; commodityId: string; side: TradeSide; quantity: number }) =>
      tradeApi.trade(b),
    onSuccess: (r) => {
      qc.setQueryData(qk.me, r.player);
      qc.setQueryData(qk.inventory, r.inventory);
      void qc.invalidateQueries({ queryKey: ['market'] });
      void qc.invalidateQueries({ queryKey: qk.transactions });
    },
  });
}

export function useStartTravel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: travelApi.start,
    onSuccess: (t) => {
      qc.setQueryData(qk.travel, t);
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useSetStartCity() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: playerApi.setStartCity, onSuccess: (p) => qc.setQueryData(qk.me, p) });
}

export function useBuyVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vehicleApi.buy,
    onSuccess: (r) => {
      qc.setQueryData(qk.me, r.player);
      void qc.invalidateQueries({ queryKey: qk.vehicles });
      void qc.invalidateQueries({ queryKey: qk.inventory });
    },
  });
}

export function useActivateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vehicleApi.activate,
    onSuccess: (v) => {
      qc.setQueryData(qk.vehicles, v);
      void qc.invalidateQueries({ queryKey: qk.inventory });
      void qc.invalidateQueries({ queryKey: ['cities'] });
    },
  });
}

export function useSellVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vehicleApi.sell,
    onSuccess: (r) => {
      qc.setQueryData(qk.me, r.player);
      void qc.invalidateQueries({ queryKey: qk.vehicles });
      void qc.invalidateQueries({ queryKey: qk.inventory });
    },
  });
}

export function useBuyEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: equipmentApi.buy,
    onSuccess: (r) => {
      qc.setQueryData(qk.me, r.player);
      void qc.invalidateQueries({ queryKey: qk.equipment });
      void qc.invalidateQueries({ queryKey: qk.inventory });
    },
  });
}

function useClanInvalidation() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.clans });
    void qc.invalidateQueries({ queryKey: qk.invites });
    void qc.invalidateQueries({ queryKey: qk.me });
    void qc.invalidateQueries({ queryKey: ['rankings'] });
  };
}

export function useCreateClan() {
  const inv = useClanInvalidation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clanApi.create,
    onSuccess: (c) => {
      qc.setQueryData(qk.clan(c.id), c);
      inv();
    },
  });
}

export function useInviteToClan(clanId: string) {
  const inv = useClanInvalidation();
  return useMutation({ mutationFn: (name: string) => clanApi.invite(clanId, name), onSuccess: inv });
}

export function useAnswerInvite() {
  const inv = useClanInvalidation();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) return clanApi.accept(id);
      await clanApi.decline(id);
      return null;
    },
    onSuccess: inv,
  });
}

export function useLeaveClan() {
  const inv = useClanInvalidation();
  return useMutation({ mutationFn: clanApi.leave, onSuccess: inv });
}

export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => (id === 'all' ? notificationApi.readAll() : notificationApi.read(id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}
