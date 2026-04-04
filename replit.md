# Overview

Rhome is a React Native mobile application designed to streamline housing and roommate searches by connecting renters and hosts. It features a role-based, swipe-based matching system, AI-powered matching, property listings, group functionalities, and secure communication. The project aims to become the leading platform for seamless housing and roommate discovery.

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

## Frontend

The application is built with React Native, Expo, and TypeScript. React Navigation handles role-based access for Renters, Hosts, and Agents/Landlords. It supports light/dark modes, animations using React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**
-   **Matching & Profiles:** Includes compatibility algorithms, interest tags, personality quizzes, and location matching.
-   **Role-Specific Features:**
    -   **Renter:** Swipe-based matching, 1-on-1 messaging, group management, advanced property search filters, saved properties, AI Match Assistant, property reviews, and chat scheduling. Features an "Renter Intent System" for onboarding.
    -   **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, and group matches monetization. Includes a multi-step listing wizard. Supports Individual, Company, and Agent host types with features like Rhome Select Badge, Company Teams, and Group Bookings. Company hosts can invite and manage agents. Listing Performance Stats screen with time-series bar charts, stat cards, response time gauges, and boost impact analysis (plan-gated). Inquiry Trends & Conversion Funnel screen with visual funnel (views/saves/inquiries/accepted/booked), status breakdown, stacked daily inquiry charts, response time trends, super interest rate, and top listings leaderboard. Revenue & Spending Overview screen with total spend/booking revenue summary, spending breakdown bars, monthly stacked bar trend, ROI metrics (cost per inquiry/booking), and recent transaction activity feed (plan-gated).
-   **Welcome Tour (Coach Marks):** Spotlight-style onboarding overlays shown on first visit to key screens. TourProvider context with AsyncStorage persistence, reusable CoachMark overlay component, and useTourSetup hook. Tours: Explore (3 stops), Roommates (3 stops), Messages (2 stops), Host Dashboard (3 stops).
-   **Progress-Based Feature Unlock:** Gamified tier system (Bronze/Silver/Gold/Platinum) gating features behind profile completion milestones. `profileGate.ts` computes tier from 9 profile items. `FeatureGateModal` shows what to complete. `LevelUpToast` animates tier-up celebrations. Gates: swipe (Silver), save (Silver), message (Gold), super like (Gold). Tier badge on ProfileScreen.
-   **Group Apartment Voting & Comparison:** Shortlisting with voting, progress bars, and side-by-side listing comparisons.
-   **Smart Recommendations Feed:** Personalized sections on the Explore screen including "Best Match Today," "New This Week," and "Price Drops."
-   **AI-Powered Enhancements:** AI Assistant for housing help, AI-generated match explanations, listing suggestions, AI tools for agents/companies, AI-suggested meetups, and AI Neighborhood Intelligence.
-   **Pi AI Matchmaker:** An AI persona providing insights, deck rankings, and preference parsing, integrated with a subscription model.
-   **Pi Demand Intelligence:** Aggregates anonymous renter activity for market insights.
-   **Contact Info Protection:** Platform-level contact information blurring in chat for free users.
-   **Agent/Company Messaging Paywall:** Blurred message previews for free-tier agents/companies.
-   **Verification & Safety:** Features Instagram verification, multi-photo enforcement, chat leakage detection, background checks, identity verification, a References System, Agent License Verification, email domain blocking, email verification, password recovery, and a comprehensive block/report system.
-   **Profile Pause:** Renters can pause their search profiles.
-   **Activity Decay Ranking:** Inactive user profiles are deprioritized in discovery.
-   **Boost System:** A three-tier system for hosts to improve listing visibility with various benefits and analytics.
-   **Account Management:** Soft-delete functionality.
-   **Subscription Management:** Tiered subscription plans for different user roles with a hybrid payment architecture.
-   **UI/UX:** Consistent dark theme, collapsible/sticky headers, platform-specific interactions, and a comprehensive location system with Area Info Cards.
-   **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.
-   **Affiliate Program:** Users can apply to become affiliates with referral codes and a dashboard.
-   **Request to Join Group:** Renters can browse and send requests to open groups.
-   **Couple & Room-Matching System:** Groups support couples sharing bedrooms and dynamic inquiry functionality based on group-listing compatibility.
-   **Host Gender Preference on Listings:** Individual hosts can set preferred tenant gender for room-type listings, influencing bidirectional feed filtering.
-   **Household Gender Preference:** Collected during renter onboarding for enhanced matching.
-   **Amenity System:** Centralized definitions for categorized display and preference filtering.
-   **Host Badge System:** Earned achievement badges (Rhome Select, Top Agent, Top Company) based on criteria.
-   **Apartment Seeker Group System:** Redesigned group experience with inviting, shared liked listings, and tour scheduling.

## Backend

Supabase provides the complete backend infrastructure:
-   **Auth:** Email/password authentication with Row Level Security (RLS).
-   **Database:** PostgreSQL with RLS, computed columns, and preference tables.
-   **Realtime:** Subscriptions for messaging and notifications.
-   **Push Notifications:** Expo Notifications handled by a service and Edge Functions.
-   **Storage:** For media assets.
-   **Edge Functions:** Used for webhooks, verification, payments, AI operations, and match calculations.
-   **Neighborhood Knowledge Base:** A PostgreSQL table with pre-seeded data for NYC/NJ neighborhoods, queried by Pi AI.

## Technical Decisions

The architecture includes a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), robust error handling, separate stack navigators with history, and efficient data fetching to prevent N+1 issues.

# External Dependencies

-   Expo
-   React Native
-   React Navigation
-   @react-native-community/datetimepicker
-   React Native Reanimated
-   @stripe/stripe-react-native
-   react-native-purchases (RevenueCat)
-   @react-native-async-storage/async-storage
-   react-native-maps
-   react-native-google-places-autocomplete
-   react-native-webview
-   expo-notifications
-   expo-device
-   Supabase (Auth, Database, Realtime, Storage, Edge Functions)
-   Claude (for AI operations)
-   Walk Score API
-   Overpass API
-   NYC Open Data