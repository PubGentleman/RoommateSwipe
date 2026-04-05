# Overview

Rhome is a React Native mobile application designed to connect renters and hosts, streamlining housing and roommate searches. It features a role-based, swipe-based matching system, AI-powered matching, property listings, group functionalities, and secure communication. The project aims to become the leading platform for seamless housing and roommate discovery by offering enhanced smart match scoring, visual compatibility breakdowns, AI roommate insights, advanced search filters, interactive map views, and a gamified progress-based feature unlock system.

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

The application uses React Native, Expo, and TypeScript, with React Navigation for role-based access. It supports light/dark modes, animations with React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**

*   **Matching & Profiles:** Implements compatibility algorithms, interest tags, personality quizzes, and location matching. Features an enhanced smart match scoring system with user-customizable priority sliders, learned weights, visual compatibility breakdowns, and AI-powered roommate insights. Dealbreaker pre-filtering is applied in the swipe deck and group auto-assembly.
*   **Role-Specific Features:**
    *   **Renter:** Offers swipe-based matching, 1-on-1 messaging, group management, advanced property search filters, saved properties, an AI Match Assistant, property reviews, chat scheduling, an "Renter Intent System," and an interactive map view with draw-to-search functionality.
    *   **Host:** Provides a dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, and group matches monetization. Supports Individual, Company, and Agent host types with features like Rhome Select Badge and Company Teams.
*   **User Onboarding & Engagement:** Features a streamlined onboarding flow, a tutorial carousel, and profile completion nudges. A Welcome Tour with coach marks and a progress-based feature unlock system gamify user engagement.
*   **Group Functionality:** Supports group apartment voting and comparison, shared listings, couple & room-matching, and enhanced group messaging with features like @mentions, pinned messages, admin moderation, and read status tracking.
*   **Activity Feed:** A centralized `ActivityFeedScreen` surfaces new matches, group activity, listing price drops, and other events, featuring filter tabs, date-grouped sections, infinite scroll, real-time updates, and deep link navigation.
*   **Social Profiles & Sharing:** Includes shareable public profile cards, a testimonials system with approval flow, roommate resume export, and profile share tracking.
*   **Personalization:** Provides a Smart Recommendations Feed and an AI "For You" Feed that leverages user interactions for personalized listing suggestions.
*   **AI-Powered Enhancements:** Integrates an AI Assistant, AI-generated match explanations, listing suggestions, AI tools for agents/companies, AI-suggested meetups, AI Neighborhood Intelligence, and "Pi AI Matchmaker."
*   **Enhanced Chat:** Features message reactions, reply threading, voice messages, link previews, real-time typing indicators, and online/last-seen presence tracking. Supports media and file sharing with multi-image selection, compression, thumbnail generation, and a conversation media grid screen. A host role identity system provides role-specific message badges and accent-colored bubbles.
*   **Security & Safety:** Includes robust verification features (Instagram, multi-photo, identity, agent license), background checks, a block/report system, chat leakage detection, contact info protection, and a Trust Score system.
*   **Monetization & Management:** Features a Boost System for hosts to improve listing visibility across various app sections, impression tracking, and tiered subscription plans for different user roles.
*   **Account Management:** Includes soft-delete functionality and the ability for renters to pause their search profiles.
*   **Referral & Invite System:** A user-facing referral system allows users to invite friends and earn in-app credits, with a rewards ladder for milestones.
*   **Community Events & Meetups:** A full event system for creating, discovering, and RSVPing to community events like apartment viewings and roommate meetups, with features for event details, comments, and attendee management.
*   **UI/UX:** Employs a consistent dark theme, collapsible/sticky headers, platform-specific interactions, a comprehensive location system with Area Info Cards, and supports Renter/Host mode switching.
*   **Preferences & Amenities:** Allows hosts to set gender preferences for listings and renters to specify household gender preferences. Features a centralized amenity system and a Host Badge System.

## Backend

Supabase provides the complete backend infrastructure:
*   **Auth:** Email/password authentication with Row Level Security (RLS).
*   **Database:** PostgreSQL with RLS and computed columns.
*   **Realtime:** Subscriptions for messaging, notifications, typing indicators, and online presence tracking.
*   **Push Notifications:** Handled by a service and Edge Functions.
*   **Storage:** For media assets.
*   **Edge Functions:** Used for webhooks, verification, payments, AI operations, and match calculations.
*   **Neighborhood Knowledge Base:** A PostgreSQL table with pre-seeded data for NYC/NJ neighborhoods.

## Technical Decisions

The architecture includes a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), robust error handling, separate stack navigators with history, and efficient data fetching.

# External Dependencies

*   Expo
*   React Native
*   React Navigation
*   @react-native-community/datetimepicker
*   React Native Reanimated
*   @stripe/stripe-react-native
*   react-native-purchases (RevenueCat)
*   @react-native-async-storage/async-storage
*   react-native-maps
*   react-native-google-places-autocomplete
*   react-native-webview
*   expo-notifications
*   expo-device
*   Supabase (Auth, Database, Realtime, Storage, Edge Functions)
*   Claude (for AI operations)
*   Walk Score API
*   Overpass API
*   NYC Open Data