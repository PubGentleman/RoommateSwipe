# Overview

Roomdr is a React Native mobile application designed to be the "Airbnb for roommates," connecting renters and hosts to streamline the housing and roommate search process. It offers role-based navigation, swipe-based roommate matching, property listings, group formation, and secure messaging. The platform aims to capture a significant share of the roommate search market by providing a comprehensive and intuitive solution for finding compatible roommates and suitable properties.

# User Preferences

Preferred communication style: Simple, everyday language.

**Code Organization Standards:**
- Always prefer simple solutions
- Avoid code duplication by checking existing implementations
- Keep files under 200-300 lines of code; refactor when exceeded
- Be careful to only make requested changes or well-understood related changes
- Never add stubbing or fake data patterns for dev/prod environments
- Maintain clean, organized codebase structure
- Avoid writing one-time scripts in persistent files

**Change Management:**
- When fixing bugs, exhaust all options with existing implementation before introducing new patterns
- If introducing new patterns, remove old implementation completely
- Never overwrite .env files without confirmation

# System Architecture

## Core Functionality

Roomdr implements a points-based compatibility algorithm (0-100 score) using 14 weighted factors, including location, budget, interest tag overlap, and conflicting lifestyle penalties. A sophisticated interest tag system allows users to select 3-10 tags from predefined categories, which are used in the matching algorithm and displayed on user profiles.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, featuring React Navigation for role-based access (Renter, Host, Agent/Landlord) and a theme system supporting light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and map/list views, saved properties, profile view tracking, AI Match Assistant, animated match celebration, report/block system, notification feed, profile completion indicator, mutual interest flow, and cold messaging (Elite).
- **Host:** Full host dashboard with statistics, listing management (create, edit, delete, pause, mark rented), dedicated Inquiries screen, inquiry-based analytics, and role switching.

**User Experience Enhancements:**
- **Match Celebration:** Animated full-screen modal for mutual likes.
- **Profile Questionnaire:** A 14-step questionnaire with progress tracking and per-step validation. During initial signup onboarding, only the first 5 steps are shown (Photos, Basic Info, Gender, Location & Work, Bio); remaining steps are completed later via Edit Profile. Occupation uses `OccupationBarSelector` (tap-to-open bottom sheet with categorized occupation tags). Interests use `InterestCategoryBars` (category bars with per-category modals, required/optional badges, Done button). Required categories: Lifestyle, Habits, Hobbies. Optional: Social, Diet. Validation via `validateInterestTags` in `profileReminderUtils.ts`.
- **Roomdr AI Assistant:** A floating, context-aware AI button providing dynamic greetings, content cards, and insights based on the current screen and live data. Includes a `profile_reminder` mode that shows profile completion gaps with personalized messages and "Fix" buttons navigating to the correct questionnaire step.
- **AI Profile Completion Reminders:** Smart triggers show profile gap reminders via the AI sheet: (1) after 5 swipes with no match (once per session), (2) daily nudge on first Match screen open if profile < 80% complete, (3) tapping ProfileCompletionCard on Profile screen, (4) after sending first-ever message. Tracking via AsyncStorage keys: `lastProfileReminderDate:${userId}`, `swipeReminderShownThisSession` (ref-based), `firstMessageReminderShown:${userId}`.
- **Roommate Interaction System:** Three types: Swipe Right (free), Super Interest (notifies recipient), and Cold Messaging (Elite only).
- **Profile Boost System:** Tier-based boosts (12-48 hours) increase profile visibility.
- **Identity Verification:** Options for phone, government ID, social media, and optional background/income checks for Elite users.
- **Onboarding Tutorial:** Swipeable tutorial for new users.
- **App Diagnostics:** Hidden screen for health checks.
- **Read Receipts:** For Elite users.
- **Who Liked You:** For Plus/Elite users.

Animations are handled by React Native Reanimated, gestures by React Native Gesture Handler, and state management utilizes React Context API and AsyncStorage.

## Backend (Supabase)

Supabase serves as the comprehensive backend, providing:
- **Auth**: Email/password authentication.
- **Database**: PostgreSQL with Row Level Security (RLS) enabled across all tables for users, profiles, listings, matches, messages, subscriptions, and more.
- **Realtime**: Subscriptions for messages and notifications.
- **Storage**: Buckets for profile and listing photos.
- **Supabase Edge Functions**: For Stripe webhook handling.

All screens prioritize Supabase data access, with AsyncStorage as a fallback cache. Coordinate data is standardized and normalized.

## Authentication & Authorization

Supabase Auth manages user authentication, with an `AuthContext` handling session management and role-based access for `renter` and `host` roles. A mandatory 2-step onboarding flow (Profile Creation, Plan Selection) gates access for new users post-signup.

## Subscription & Paywall System

The application features tiered subscription plans for both renters (Basic, Plus, Elite) and hosts (Starter, Pro, Business), including one-time purchases. A `PaywallSheet` component prompts users for upgrades when limits are reached. Billing cycles include monthly, 3-month, and annual options. Dedicated screens for Renter Subscription, Host Pricing, and Manage Subscription provide detailed plan information, upgrade/downgrade options, and billing history.

## Data Layer

The data layer uses Supabase PostgreSQL, supported by local AsyncStorage for caching. TypeScript interfaces define core models like `User`, `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `InterestCard`. Service files abstract database operations.

## UI/UX and Branding

A consistent dark theme with specific color palettes is used throughout the application. The `RoomdrLogo` component renders the brand logo using `react-native-svg` and `expo-linear-gradient`, featuring coral-red gradients and white.

## Location System

The application supports over 10 US cities with a centralized location data system and a `LocationPicker` component. A `CityContext` synchronizes city selections across tabs, persisting data via AsyncStorage. Comprehensive match filters (Budget, Move-in Date, Room Type, Lifestyle, Search Radius, Minimum Compatibility) are persistently stored and displayed as dismissible chips.

## Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and robust error handling through an error boundary component.

# External Dependencies

**Core Framework:**
- `expo`
- `react-native`
- `react-navigation`

**UI Components & Styling:**
- `expo-blur`
- `expo-symbols`
- `@expo/vector-icons`
- `react-native-safe-area-context`
- `expo-system-ui`
- `@react-native-community/datetimepicker`

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Maps:**
- `react-native-maps`
- `react-native-webview`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`