'use client';

import * as React from 'react';
import { ProductTour } from '@zameen/ui';
import type { TourStep } from '@zameen/ui';
import { markTourComplete, skipTour } from '@/modules/profile/actions';

export interface RoleTourProps {
  tourId: string;
  steps: TourStep[];
  alreadySeen: boolean;
}

export function RoleTour({ tourId, steps, alreadySeen }: RoleTourProps) {
  if (alreadySeen) return null;
  return (
    <ProductTour
      tourId={tourId}
      steps={steps}
      autoStart
      onComplete={() => {
        void markTourComplete(tourId);
      }}
      onSkip={() => {
        void skipTour(tourId);
      }}
    />
  );
}
