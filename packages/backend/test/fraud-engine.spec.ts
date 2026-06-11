import { FraudScoringService } from '../src/modules/fraud/fraud-scoring.service';
import { ImpossibleTravelDetector } from '../src/modules/fraud/detectors/impossible-travel.detector';
import { GpsAnomalyDetector } from '../src/modules/fraud/detectors/gps-anomaly.detector';
import { AbnormalDurationDetector } from '../src/modules/fraud/detectors/abnormal-duration.detector';
import { VisitFeatureContext } from '../src/modules/fraud/detectors/types';
import { haversineMeters, speedKmh } from '../src/common/util/geo';
import { scoreToRiskLevel } from '../src/common/util/risk';

const baseCtx = (overrides: Partial<VisitFeatureContext>): VisitFeatureContext => ({
  visit: {
    id: 'v1',
    organizationId: 'o1',
    caregiverId: 'c1',
    patientId: 'p1',
    providerId: 'pr1',
    scheduledStart: new Date('2026-06-09T14:00:00Z'),
    clockInAt: new Date('2026-06-09T14:02:00Z'),
    clockInLat: 39.7817,
    clockInLng: -89.6501,
  },
  authorization: { latitude: 39.7817, longitude: -89.6501, radiusMeters: 150, authorizedUnits: null },
  identity: { result: 'PASS', confidenceScore: 0.97, livenessScore: 0.99 },
  device: null,
  caregiverRecentVisits: [],
  patientRecentVisits: [],
  config: { impossibleTravelKmh: 900, duplicateWindowMin: 10 },
  ...overrides,
});

describe('geo utilities', () => {
  it('computes haversine distance (~0 for same point)', () => {
    expect(haversineMeters({ lat: 39.7817, lng: -89.6501 }, { lat: 39.7817, lng: -89.6501 })).toBeCloseTo(0, 1);
  });
  it('flags impossible speeds', () => {
    const d = haversineMeters({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
    expect(speedKmh(d, 20 * 60 * 1000)).toBeGreaterThan(900);
  });
});

describe('risk banding', () => {
  it('maps scores to bands', () => {
    expect(scoreToRiskLevel(10)).toBe('LOW');
    expect(scoreToRiskLevel(45)).toBe('MODERATE');
    expect(scoreToRiskLevel(75)).toBe('HIGH');
    expect(scoreToRiskLevel(95)).toBe('CRITICAL');
  });
});

describe('GpsAnomalyDetector', () => {
  const det = new GpsAnomalyDetector();
  it('passes inside the radius', () => {
    const r = det.detect(baseCtx({}));
    expect(r.triggered).toBe(false);
  });
  it('fails on a major discrepancy', () => {
    const r = det.detect(
      baseCtx({ visit: { ...baseCtx({}).visit, clockInLat: 39.9, clockInLng: -89.9 } }),
    );
    expect(r.triggered).toBe(true);
    expect(r.evidence.decision).toBe('FAIL');
    expect(r.severity).toBeGreaterThan(70);
  });
});

describe('ImpossibleTravelDetector', () => {
  const det = new ImpossibleTravelDetector();
  it('triggers when implied speed exceeds threshold', () => {
    const ctx = baseCtx({
      caregiverRecentVisits: [
        { id: 'v0', clockInAt: new Date('2026-06-09T13:50:00Z'), clockInLat: 34.0522, clockInLng: -118.2437, patientId: 'p9' },
      ],
    });
    const r = det.detect(ctx);
    expect(r.triggered).toBe(true);
    expect(Number(r.evidence.impliedSpeedKmh)).toBeGreaterThan(900);
  });
});

describe('AbnormalDurationDetector', () => {
  const det = new AbnormalDurationDetector();
  it('flags sub-2-minute visits via the hard floor', () => {
    const ctx = baseCtx({ visit: { ...baseCtx({}).visit, durationMinutes: 1 } });
    const r = det.detect(ctx);
    expect(r.triggered).toBe(true);
    expect(r.evidence.rule).toBe('hard_floor_2min');
  });
});

describe('FraudScoringService fusion', () => {
  const scoring = new FraudScoringService();
  it('returns 0/LOW when nothing triggers', () => {
    const out = scoring.fuse([]);
    expect(out.score).toBe(0);
    expect(out.riskLevel).toBe('LOW');
  });
  it('combines multiple signals into a higher composite with explainable factors', () => {
    const det = [new GpsAnomalyDetector(), new AbnormalDurationDetector()];
    const ctx = baseCtx({
      visit: { ...baseCtx({}).visit, clockInLat: 39.9, clockInLng: -89.9, durationMinutes: 1 },
    });
    const results = det.map((d) => d.detect(ctx));
    const out = scoring.fuse(results);
    expect(out.score).toBeGreaterThan(60);
    expect(out.factors.length).toBe(2);
    expect(out.factors[0].contribution).toBeGreaterThan(0);
  });
});
