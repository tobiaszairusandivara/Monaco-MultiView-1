import { Routes } from '@angular/router';
import { DashboardComponent } from './views/dashboard';
import { ChallengeWizardComponent } from './views/challenge-wizard';
import { ChallengePublishedComponent } from './views/challenge-published';
import { ChallengeSolveComponent } from './views/challenge-solve';
import { ChallengeResultComponent } from './views/challenge-result';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'challenges/new', component: ChallengeWizardComponent },
  { path: 'challenges/:id/edit', component: ChallengeWizardComponent },
  { path: 'challenges/:id/solve', component: ChallengeSolveComponent },
  { path: 'challenges/:id/result', component: ChallengeResultComponent },
  { path: 'challenges/:id/published', component: ChallengePublishedComponent },
  { path: '**', redirectTo: 'dashboard' },
];