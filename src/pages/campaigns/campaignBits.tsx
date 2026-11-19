import { CSSProperties } from 'react';
import { BookOpen, Handshake, Mail, Megaphone, Search, Share2, Tent, Video } from 'lucide-react';
import { CampaignStatus } from '../../types';
import { ChannelIcon, channelHue, channelIcon, statusHue } from './campaignLogic';

const ICONS: Record<ChannelIcon, typeof Mail> = { mail: Mail, share: Share2, video: Video, book: BookOpen, search: Search, tent: Tent, hand: Handshake, mega: Megaphone };

export const hue = (c: string) => ({ '--c': c }) as CSSProperties;

export function ChannelGlyph({ channel, size = 17 }: { channel?: string; size?: number }) {
  const Icon = ICONS[channelIcon(channel)];
  return <Icon size={size} aria-hidden="true" />;
}

/** The channel's name after a small diamond in its colour. */
export function ChannelChip({ channel }: { channel: string }) {
  return <span className="cp-ch" style={hue(channelHue(channel))}><i />{channel}</span>;
}

/** The rounded square in the channel's colour that stands for a campaign. */
export function ChannelBadge({ channel, size = 'big' }: { channel?: string; size?: 'big' | 'small' }) {
  return (
    <span className={`cp-badge ${size}`} style={hue(channel ? channelHue(channel) : '#8a93a6')}>
      <ChannelGlyph channel={channel} size={size === 'big' ? 26 : 20} />
    </span>
  );
}

export function CampaignStatusPill({ status }: { status: CampaignStatus | string }) {
  return <span className="pq-pill" style={hue(statusHue(status))} data-testid="campaign-status"><i />{status}</span>;
}

/** A ring that fills to value / max. */
export function GoalRing({ value, max, color, size = 54 }: { value: number; max: number; color: string; size?: number }) {
  const r = size / 2 - 5;
  const len = 2 * Math.PI * r;
  const f = Math.min(1, max ? value / max : 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="cp-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      {f > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${len * f} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
    </svg>
  );
}
