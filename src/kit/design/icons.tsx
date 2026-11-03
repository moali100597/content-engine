import React from 'react';
import { IconBed, IconBuildingSkyscraper, IconBus, IconCar, IconClock24, IconMapPin, IconMoodKid, IconParking, IconShieldCheck, IconStar, IconToolsKitchen2, IconWalk, IconWifi, IconWindow, IconHeadset, IconCreditCard, IconContract, IconSettings, IconCashBanknote, IconKey, IconCheck, IconX, IconLock, IconAirConditioning, IconBulb, IconDeviceMobile, IconSparkles, IconTool, IconCalendarCheck, IconBellRinging } from '@tabler/icons-react';

/** Amenity and fact icons (Tabler, MIT). Named by meaning so specs stay readable. */
const MAP: Record<string, React.FC<{ size?: number; stroke?: number; color?: string }>> = {
  wifi: IconWifi, breakfast: IconToolsKitchen2, '24h': IconClock24, parking: IconParking, car: IconCar, bus: IconBus,
  stars: IconStar, walk: IconWalk, view: IconWindow, tower: IconBuildingSkyscraper, kids: IconMoodKid, pin: IconMapPin,
  bed: IconBed, support: IconHeadset, safe: IconShieldCheck, card: IconCreditCard,
  clean: IconSparkles, tool: IconTool, booking: IconCalendarCheck, bell: IconBellRinging, lock: IconLock, ac: IconAirConditioning, bulb: IconBulb, phone: IconDeviceMobile, contract: IconContract, gear: IconSettings, cash: IconCashBanknote, key: IconKey, check: IconCheck, x: IconX,
};
export const Icon: React.FC<{ name: string; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 1.6 }) => {
  const C = MAP[name] ?? IconStar;
  return <C size={size} stroke={stroke} color={color} />;
};
export const ICONS = Object.keys(MAP);
