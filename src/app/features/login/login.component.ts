import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Schoology Calendar</mat-card-title>
          <mat-card-subtitle>Login with your LCPS credentials</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="your.name@lcps.org"
                required
                [disabled]="isLoading"
              />
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                [(ngModel)]="password"
                name="password"
                required
                [disabled]="isLoading"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
                [disabled]="isLoading"
              >
                <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
            </mat-form-field>

            <div class="actions">
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!loginForm.valid || isLoading"
                class="login-button"
              >
                <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
                <span *ngIf="!isLoading">Continue to Calendar</span>
                <span *ngIf="isLoading">Logging in...</span>
              </button>
            </div>
          </form>

          <div class="info-section">
            <mat-icon>info</mat-icon>
            <div class="info-text">
              <p><strong>How it works:</strong></p>
              <ul>
                <li>Import your Schoology calendar .ics file</li>
                <li>View all your assignments and exams in one place</li>
                <li>Sync updates by re-importing your calendar</li>
              </ul>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
      max-width: 500px;
      width: 100%;
    }

    mat-card-header {
      margin-bottom: 24px;
    }

    mat-card-title {
      font-size: 28px;
      font-weight: 600;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .actions {
      margin-top: 24px;
      text-align: center;
    }

    .login-button {
      width: 100%;
      height: 48px;
      font-size: 16px;
    }

    .login-button mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    .info-section {
      margin-top: 32px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
      display: flex;
      gap: 16px;
    }

    .info-section mat-icon {
      color: #667eea;
      flex-shrink: 0;
    }

    .info-text {
      font-size: 14px;
      color: #666;
    }

    .info-text strong {
      color: #333;
    }

    .info-text ul {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }

    .info-text li {
      margin-bottom: 4px;
    }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  hidePassword = true;
  isLoading = false;

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private storage: StorageService
  ) {}

  async ngOnInit() {
    // Check if user has already logged in (has events data)
    const events = await this.storage.getAllEvents();
    if (events.length > 0) {
      // User has data, navigate to calendar
      this.router.navigate(['/calendar']);
    }
  }

  async onSubmit() {
    if (!this.email || !this.password) {
      this.snackBar.open('Please enter both email and password', 'Close', {
        duration: 3000
      });
      return;
    }

    this.isLoading = true;

    try {
      // Store credentials in localStorage (Note: This is just for demo - in production,
      // you would validate against Schoology API)
      localStorage.setItem('schoology_email', this.email);

      this.snackBar.open('Login successful! Please import your calendar.', 'Close', {
        duration: 3000
      });

      // Navigate to calendar/import view
      setTimeout(() => {
        this.router.navigate(['/calendar']);
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      this.snackBar.open(
        `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isLoading = false;
    }
  }
}
