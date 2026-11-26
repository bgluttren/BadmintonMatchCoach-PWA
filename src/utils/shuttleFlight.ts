import { RallyOutcome, ShotRecord, ShotType } from '../types/match';
import {
  CENTER_Y,
  COURT_WIDTH,
  NET_X,
} from './bwfEngine';

export const TILT_VIEWBOX_X = -140;
export const TILT_VIEWBOX_Y = -205;
export const TILT_VIEWBOX_W = 1720;
export const TILT_VIEWBOX_H = 1030;

export const FLOOR_CENTER_Y = 470;
export const TILT_Y_SCALE = 0.78; // ~22% foreshortened court depth
export const TILT_PERSPECTIVE = 0.2; // 20% perspective taper from far to near sideline
export const TILT_Z_SCALE = 0.62; // Exaggerated vertical elevation scale for clear height readability
export const BWF_NET_HEIGHT_CM = 155;
export const MAX_SHUTTLE_APEX_CM = 820;

export interface Point2D {
  x: number;
  y: number;
}

export interface ShuttleArcSample {
  courtX: number;
  courtY: number;
  heightCm: number;
  screen: Point2D;
  shadow: Point2D;
}

export interface ShuttleSegmentFlight {
  shotId: string;
  fromShotNumber: number;
  toShotNumber: number;
  isGhost: boolean;
  side: 'A' | 'B' | null;
  dtSec: number;
  distMeters: number;
  avgSpeedKmh: number;
  peakHeightCm: number;
  peakHeightMeters: number;
  peakScreen: Point2D;
  peakShadow: Point2D;
  samples: ShuttleArcSample[];
}

export interface RallyFlightAnalysis {
  nodeHeightsCm: number[];
  segments: ShuttleSegmentFlight[];
}

/**
 * Projects 3D court coordinates (cm) onto a 20%-tilted perspective SVG canvas.
 */
export function projectCourt3D(
  x: number,
  y: number,
  zCm = 0
): Point2D {
  const cx = x - NET_X;
  const ny = (y - CENTER_Y) / COURT_WIDTH; // -0.5 far sideline .. +0.5 near sideline
  const p = Math.max(0.76, Math.min(1.24, 1 + TILT_PERSPECTIVE * ny));
  return {
    x: NET_X + cx * p,
    y:
      FLOOR_CENTER_Y +
      (y - CENTER_Y) * TILT_Y_SCALE * p -
      zCm * TILT_Z_SCALE * p,
  };
}

/**
 * Skewed shuttlecock arc profile in [0, 1]:
 * Rises gently and drops slightly steeper near the end due to air drag.
 * Normalized so peak ~ 1.0 at u ~ 0.55.
 */
function shuttleDragArcFactor(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return 3.5 * u * Math.pow(1 - u, 0.82);
}

/**
 * Computes realistic, visually distinct shuttlecock node heights and 3D trajectories:
 * - Fast long shots (short dt / high horizontal speed) stay razor-flat just over the 155 cm net.
 * - Longer time between shots (high dt / lower horizontal speed) amplifies arc lift up to ~8.2 m.
 * - Cross-net shots automatically clear the 155 cm BWF net unless it's a net fault.
 */
export function computeRallyFlightAnalysis(
  shots: ShotRecord[],
  outcome: RallyOutcome,
  finishingShotType: ShotType | null
): RallyFlightAnalysis {
  if (shots.length === 0) {
    return { nodeHeightsCm: [], segments: [] };
  }

  // 1. Determine realistic hit/landing heights at every shot node
  const nodeHeightsCm: number[] = shots.map((shot, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === shots.length - 1;

    if (isLast && shots.length >= 2) {
      const isNetFault =
        outcome === 'FAULT' && Math.abs(shot.x - NET_X) <= 130;
      return isNetFault ? 95 : 0;
    }

    if (isFirst) {
      return 105; // BWF 1.15m service height zone
    }

    const prev = shots[idx - 1];
    const dtInSec = Math.max(
      0.2,
      Math.min(2.8, (shot.timestamp - prev.timestamp) / 1000)
    );

    const isFinishingStroke = idx === shots.length - 2;
    if (isFinishingStroke && finishingShotType) {
      if (finishingShotType === 'Smash') return 250;
      if (finishingShotType === 'Clear' || finishingShotType === 'Drop') {
        return 215;
      }
      if (finishingShotType === 'Net Stop' || finishingShotType === 'Lift') {
        return 92;
      }
      if (finishingShotType === 'Drive') return 142;
      if (finishingShotType === 'Block') return 115;
    }

    if (dtInSec >= 1.2) return 180;
    if (dtInSec <= 0.6) return 122;
    return 145;
  });

  // 2. Compute each segment's 3D aerodynamic arc
  const segments: ShuttleSegmentFlight[] = [];
  const sampleSteps = 24;

  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1];
    const shot = shots[i];
    const isLastSeg = i === shots.length - 1;

    const dxCm = shot.x - prev.x;
    const dyCm = shot.y - prev.y;
    const distCm = Math.hypot(dxCm, dyCm);
    const distMeters = distCm / 100;

    const dtSec = Math.max(
      0.2,
      Math.min(2.8, (shot.timestamp - prev.timestamp) / 1000)
    );
    const avgSpeedMs = distMeters / dtSec;
    const avgSpeedKmh = Math.round(avgSpeedMs * 3.6);

    const z0 = nodeHeightsCm[i - 1];
    const z1 = nodeHeightsCm[i];

    // Exaggerated aerodynamic flight height formula:
    // - Long dt amplifies hang height steeply (~dt^2.05).
    // - High horizontal speed suppresses arc strongly (~(v/8.5)^2.6) so fast long shots fly flat and low.
    const rawTimeLiftCm = 240 * Math.pow(dtSec, 2.05);
    const speedSuppression = 1 + Math.pow(avgSpeedMs / 8.5, 2.6);
    let extraArcCm = rawTimeLiftCm / speedSuppression;

    // Smashes keep a flat, aggressive downward trajectory
    if (isLastSeg && finishingShotType === 'Smash') {
      extraArcCm = Math.min(extraArcCm, 20);
    }

    // Ensure non-fault cross-net shots clear the 155 cm net tape
    const crossesNet = (prev.x - NET_X) * (shot.x - NET_X) < 0;
    const isNetFault =
      isLastSeg && outcome === 'FAULT' && Math.abs(shot.x - NET_X) <= 130;
    if (crossesNet && !isNetFault && Math.abs(dxCm) > 1) {
      const uNet = (NET_X - prev.x) / dxCm;
      if (uNet > 0.04 && uNet < 0.96) {
        const arcAtNet = shuttleDragArcFactor(uNet);
        const linearAtNet = z0 + (z1 - z0) * uNet;
        const minClearanceCm = BWF_NET_HEIGHT_CM + 6;
        if (
          linearAtNet + extraArcCm * arcAtNet < minClearanceCm &&
          arcAtNet > 0.08
        ) {
          extraArcCm = Math.max(
            extraArcCm,
            (minClearanceCm - linearAtNet) / arcAtNet
          );
        }
      }
    }

    // Cap maximum apex so extreme slow taps stay cleanly inside the tilted SVG frame
    const approxPeakLinear = z0 + (z1 - z0) * 0.55;
    if (approxPeakLinear + extraArcCm > MAX_SHUTTLE_APEX_CM) {
      extraArcCm = Math.max(0, MAX_SHUTTLE_APEX_CM - approxPeakLinear);
    }

    const samples: ShuttleArcSample[] = [];
    let peakHeightCm = 0;
    let peakScreen: Point2D = projectCourt3D(prev.x, prev.y, z0);
    let peakShadow: Point2D = projectCourt3D(prev.x, prev.y, 0);

    for (let s = 0; s <= sampleSteps; s++) {
      const u = s / sampleSteps;
      const courtX = prev.x + dxCm * u;
      const courtY = prev.y + dyCm * u;
      const heightCm = Math.max(
        0,
        z0 + (z1 - z0) * u + extraArcCm * shuttleDragArcFactor(u)
      );
      const screen = projectCourt3D(courtX, courtY, heightCm);
      const shadow = projectCourt3D(courtX, courtY, 0);

      if (heightCm >= peakHeightCm) {
        peakHeightCm = heightCm;
        peakScreen = screen;
        peakShadow = shadow;
      }

      samples.push({
        courtX,
        courtY,
        heightCm,
        screen,
        shadow,
      });
    }

    segments.push({
      shotId: shot.id,
      fromShotNumber: prev.shotNumber,
      toShotNumber: shot.shotNumber,
      isGhost: prev.isGhost || shot.isGhost,
      side: prev.side,
      dtSec,
      distMeters,
      avgSpeedKmh,
      peakHeightCm,
      peakHeightMeters: Number((peakHeightCm / 100).toFixed(1)),
      peakScreen,
      peakShadow,
      samples,
    });
  }

  return { nodeHeightsCm, segments };
}
