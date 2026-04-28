import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="nav-container">
        <a routerLink="/" class="logo">
          <span class="f1">F1</span>
        </a>
        <button class="menu-toggle" (click)="toggleMenu()">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="nav-links" [class.open]="menuOpen">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">Home</a>
          <a routerLink="/history" routerLinkActive="active" (click)="closeMenu()">History</a>
          <a routerLink="/drivers" routerLinkActive="active" (click)="closeMenu()">Drivers</a>
          <a routerLink="/constructors" routerLinkActive="active" (click)="closeMenu()">Constructors</a>
          <a routerLink="/circuits" routerLinkActive="active" (click)="closeMenu()">Circuits</a>
          <a routerLink="/races" routerLinkActive="active" (click)="closeMenu()">Races</a>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: #ffffff;
      padding: 1rem;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 900;
      color: #1a1a1a;
      text-decoration: none;
    }
    .f1 {
      background: #e10600;
      color: #fff;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
    }
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    .nav-links a {
      color: #1a1a1a;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s;
    }
    .nav-links a:hover,
    .nav-links a.active {
      color: #e10600;
    }
    .menu-toggle {
      display: none;
      flex-direction: column;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
    }
    .menu-toggle span {
      width: 24px;
      height: 3px;
      background: #1a1a1a;
      border-radius: 2px;
    }
    @media (max-width: 768px) {
      .menu-toggle {
        display: flex;
      }
      .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #ffffff;
        flex-direction: column;
        padding: 1rem;
        gap: 1rem;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      }
      .nav-links.open {
        display: flex;
      }
    }
  `]
})
export class NavbarComponent {
  menuOpen = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }
}