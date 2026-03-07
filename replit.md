# Overview

Roomdr is a React Native mobile application designed to connect renters, hosts, and agents/landlords in the roommate-finding marketplace. It functions as an "Airbnb for roommates," offering features like role-based navigation, swipe-based roommate matching, property listings, group formation, and messaging to streamline the housing and roommate search process. The project aims to capture a significant share of the roommate search market by providing a comprehensive and intuitive platform.

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

Roomdr implements a points-based compatibility algorithm (0-100 score) across 14 weighted factors including location, budget, and lifestyle, providing detailed breakdowns with strengths and concerns. Date of Birth is used to calculate Zodiac signs for minor compatibility weighting.

## Frontend Architecture

The application is built with React Native and Expo using TypeScript, featuring React Navigation for role-based access (Renter, Host, Agent/Landlord) and a theme system for light/dark modes.

**Key Features:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and map/list views, saved properties, rewind, profile view tracking, AI Match Assistant, animated match celebration, report/block system, notification feed, and profile completion indicator. The Match screen has a dark Tinder-style UI with specific branding elements and action buttons.
- **Host:** Property listing management (CRUD), application review, and listing status control.
- **Agent:** Multi-property portfolio management, document verification, and a legal template library.

**User Experience Enhancements:**
- **Match Celebration:** An animated full-screen modal appears upon mutual likes, displaying user photos, compatibility, and options to message or continue swiping.
- **Profile Questionnaire:** A multi-step guided questionnaire replaces previous single-page forms, featuring progress tracking, `SelectionCard` components, and keyboard avoidance.
- **Report/Block System:** Users can report or block others from various screens, filtering blocked users from interactions.
- **Notification System:** A context-based system provides app-wide notifications with unread counts, real-time toast alerts, and configurable preferences.
- **Profile Completion:** A component tracks progress across 10 weighted profile fields, offering suggestions for improvement.
- **Identity Verification:** Users can verify identity via phone, government ID, and social media, with verification badges displayed across the app.
- **Onboarding Tutorial:** A swipeable tutorial introduces new users to core features upon first login.

Animations are powered by React Native Reanimated, gestures by React Native Gesture Handler, and state managed by React Context API and AsyncStorage.

## Authentication & Authorization

The system uses mock authentication for demonstration, supporting role-based navigation and conditional access for `renter`, `host`, and `agent` roles. Three subscription tiers (Basic, Plus, Elite) are planned via Stripe integration. Privacy settings and account deletion are implemented.

## Data Layer

The data layer uses mock data and TypeScript interfaces for models like `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `Application`. It supports reciprocal matching, automatic conversation creation, and message limits. Property management includes distinguishing room types and tracking existing roommates. An AI Match Assistant refines user profiles through natural language interactions.

## Branding

The `RoomdrLogo` component renders the brand logo using `react-native-svg` and `expo-linear-gradient`, with variants for horizontal, stacked, and icon-only layouts in `sm`, `md`, `lg` sizes. Brand colors are coral-red gradients and white.

## Location System

The application supports over 10 US cities across multiple states, centralizing location data. A `LocationPicker` component provides a cascading State → City → Neighborhood selection. Location filtering is applied to roommate profiles, groups, and property searches. Public property displays enforce location privacy by showing only neighborhood and city.

**Airbnb-Style City Selector:** All three main screens (Roommates, Groups Discover, Explore) feature a horizontal scrollable city pill row for easy city switching. The first pill shows the user's home city with a navigation icon, followed by "All Cities" and then all other available cities. Active pills are highlighted (red on dark screens, primary on light). Selecting a city filters content to that city; "All Cities" removes the city filter. Each screen manages its own `activeCity` state that defaults to the user's `profileData.city`.

## Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated, and error handling through an error boundary component.

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
- `react-native-maps` (iOS/Android native maps)
- Leaflet/OpenStreetMap via iframe for web maps
- `react-native-webview`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Monetization:**
- `AdBanner` component (placeholder for Google AdMob integration)

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`