# Overview

RoomieMatch is a React Native mobile application built with Expo, designed to connect renters, hosts, and agents/landlords in the roommate-finding marketplace. It aims to be an "Airbnb for roommates," offering features such as role-based navigation, swipe-based roommate matching, property listings, group formation, and messaging capabilities to streamline the housing and roommate search process.

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

## Matching Algorithm

RoomieMatch utilizes a comprehensive points-based compatibility system (0-100 score) across 12 weighted factors, with location being a major determinant through neighborhood proximity mapping. It provides detailed breakdowns with strengths, concerns, and notes for each match. Key factors include Location, Budget, Sleep Schedule, Cleanliness, Smoking/Substances, Work Location, Guest Policy, Noise Tolerance, Pets, Roommate Relationship, Lifestyle Tags, and Occupation. The system calculates scores in real-time and dynamically color-codes compatibility (Green 80%+, Blue 70%+, Orange 60%+, Red <60%).

## Frontend Architecture

The application is built with React Native and Expo, using TypeScript and leveraging React's experimental features for performance. It employs React Navigation for a role-based navigation structure (Renter, Host, Agent/Landlord) with nested navigators. UI/UX follows a theme system supporting light/dark modes and uses reusable, themed components.

**Core Features by Role:**
- **Renter:** Swipe-based matching with priority placement, 1-on-1 messaging (with limits for Basic users), Priority messaging (Priority users can message without matching; Basic users can pay $0.99 for single message), comprehensive group management, property exploration with advanced filters (Plus/Priority only), saved properties, and an AI Match Assistant (Plus/Priority). Boost feature available for profile visibility. Property listings display room type (ROOM vs ENTIRE APARTMENT), existing roommate gender for room listings, and compatibility scores with hosts for informed decision-making.
- **Host:** Property listing management (CRUD) with room type specification (room or entire apartment), existing roommate gender tracking for room listings, application review, listing status control, and featured listings (Priority only).
- **Agent:** Multi-property portfolio management, document verification, legal template library, and professional credential verification.

Animations use React Native Reanimated, and gestures are handled by React Native Gesture Handler. State management relies on React Context API for authentication and local component state, with AsyncStorage for persistent data.

## Authentication & Authorization

The system supports mock authentication with email/password and planned SSO (Apple/Google). Users have defined roles (`renter`, `host`, `agent`) with role-based navigation and conditional screen access. Three subscription tiers are implemented via Stripe integration: Basic, Plus ($14.99/month), and Priority ($49.99-$99/month). Subscription management includes full lifecycle support for cancellation, downgrades, and reactivation with prorated access and clear UI indicators. Messaging limits, boost systems, advanced filters, featured listings, online status visibility (Plus/Priority), and an AI Match Assistant (Plus/Priority) are all gated by subscription tiers.

## Data Layer

The current implementation uses mock data and TypeScript interfaces for data models such as `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `Application`. The User model tracks `messageCount` and `boostData`. It implements reciprocal matching, automatic conversation creation, and enforces message limits. Group management includes swipeable discovery and a request-to-join workflow. Property management handles featured status, host listing filtering, room type differentiation (room vs entire apartment), existing roommate gender tracking, and host profile linking for compatibility calculations. The architecture is designed for future integration with a SQL database.

**Property Model Enhancements:**
- `roomType`: Distinguishes between 'room' (single room in shared apartment) and 'entire' (entire apartment). **Note:** Studios should be listed as 'entire' unless the host is sharing the bedroom with another person (2+ people in same bedroom).
- `existingRoommates`: Array tracking all current household members with fields for gender, onApp status, and userId for those with accounts
- `hostProfileId`: Links to host's User profile for compatibility score calculation using the matching algorithm
- `propertyType`: Distinguishes between 'lease' (long-term) and 'sublet' (short-term) arrangements

**User Model Location Data:**
- Renter users automatically receive `profileData` with location fields (neighborhood, city, state, coordinates) on registration, login, and app load
- Default location set to Williamsburg, Brooklyn for new renters
- Location data is backfilled for existing users on app load to ensure city-based filtering works across all sessions

## Location Privacy & Filtering

**Location Privacy Enforcement:**
- Public property displays show only "{neighborhood}, {city}" format via the `formatLocation()` utility
- Street addresses are never displayed in public views (Explore screen, property cards, detail modals)
- Full addresses remain accessible to hosts for their own listings

**City-Based Filtering:**
- ExploreScreen defaults to showing properties only in the user's city
- Filter automatically relaxes when searching for specific city/neighborhood names
- Uses `getAllCities()` from locationData.ts for maintainable city list
- Prevents location-irrelevant results while allowing targeted location searches

## Key Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations (iOS, Android, Web), performance optimizations using React Native's New Architecture, React Compiler, Reanimated, and gesture-driven interactions. Error handling is managed by an error boundary component.

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

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Storage & State:**
- `@react-native-async-storage/async-storage`

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

**Planned Integrations:**
- Elasticsearch
- SQL database (e.g., Postgres)
- SSO providers (Apple, Google)