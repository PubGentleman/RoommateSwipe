# Overview

Rhome is a React Native mobile application designed to connect renters and hosts, streamlining housing and roommate searches. It features a role-based, swipe-based matching system, AI-powered matching, property listings, group functionalities, and secure communication. The project aims to become the leading platform for seamless housing and roommate discovery. Key capabilities include enhanced smart match scoring with adaptive weights, visual compatibility breakdowns, AI roommate insights, advanced search filters, interactive map views, and a gamified progress-based feature unlock system.

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

The application uses React Native, Expo, and TypeScript, with React Navigation for role-based access (Renters, Hosts, Agents/Landlords). It supports light/dark modes, animations with React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**

*   **Matching & Profiles:** Includes compatibility algorithms, interest tags, personality quizzes, and location matching. Features an enhanced smart match scoring system with user-customizable priority sliders and learned weights, visual compatibility breakdowns, and AI-powered roommate insights.
*   **Role-Specific Features:**
    *   **Renter:** Swipe-based matching, 1-on-1 messaging, group management, advanced property search filters, saved properties, AI Match Assistant, property reviews, chat scheduling, and an "Renter Intent System." Includes an interactive map view with Leaflet.js for property discovery and draw-to-search functionality. Renters can also save search configurations with new match alerts.
    *   **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, and group matches monetization. Supports Individual, Company, and Agent host types with features like Rhome Select Badge, Company Teams, and Group Bookings. Offers various performance analytics screens (Listing Performance, Inquiry Trends, Revenue & Spending, Comparative Insights).
*   **User Onboarding & Engagement:** Features a Welcome Tour (coach marks) for first-time users and a progress-based feature unlock system (Bronze/Silver/Gold/Platinum tiers) to gamify profile completion.
*   **Group Functionality:** Supports group apartment voting and comparison, a redesigned group experience with inviting and shared listings, and a couple & room-matching system. Enhanced group messaging with @mentions (`MentionInput`), pinned messages (`PinnedMessageBar`, `PinnedMessagesSheet`), admin moderation (pin/delete/remove), group mute/unmute, sender name labels with consistent color hashing, group online count tracking, read status tracking via `last_read_message_id`, and group chat settings (allow @everyone, allow pinning, admin-only messages). GroupInfoScreen includes quick actions row (share, mute, chat, search) and admin Chat Settings section. Migration 094 adds `reply_to_id`/`edited_at`/`deleted_at` to `group_messages`, `pinned_messages` table, `message_mentions` table, `groups.settings` JSONB, `group_members` `muted`/`nickname`/`last_read_message_id` columns.
*   **Activity Feed:** Centralized activity feed (`ActivityFeedScreen`) surfacing new matches, group activity, listing price drops, profile views, match milestones, and super interests. Features filter tabs (All/Matches/Groups/Listings/Social), date-grouped sections (Today/Yesterday/This Week/Earlier), pull-to-refresh, infinite scroll, real-time Supabase subscription for new events, unread badge on bell icon, mark-all-read, and deep link navigation to relevant screens. Backed by `activity_feed` table (migration 095) with DB triggers for match and group member events. Service: `services/activityFeedService.ts`. Context: `FeedBadgeContext` for global unread count. Plan gating: Basic=7 days, Plus=30 days, Elite=unlimited.
*   **Personalization:** Provides a Smart Recommendations Feed and an AI "For You" Feed that leverages user interactions for personalized listing suggestions.
*   **AI-Powered Enhancements:** Integrates AI Assistant, AI-generated match explanations, listing suggestions, AI tools for agents/companies, AI-suggested meetups, AI Neighborhood Intelligence, and "Pi AI Matchmaker" for insights and preference parsing.
*   **Enhanced Chat:** Message reactions (plan-gated), reply threading, voice messages, link previews, long-press actions, timestamp grouping, bubble redesign, real-time typing indicators with animated dots, and online/last-seen presence tracking via Supabase Realtime Presence. Presence service (`services/presenceService.ts`) manages global online tracking, per-conversation typing channels, and heartbeat-based last-seen updates. Components: `OnlineDot`, `TypingIndicator`. Media & file sharing with multi-image selection (up to 5), automatic image compression via `expo-image-manipulator`, thumbnail generation, multi-image grid layouts (1/2/3/4+ images), full-screen image gallery viewer with paging, upload progress indicator with cancel, conversation media grid screen (`ConversationMediaScreen`), and document sharing (PDF, Word, Excel, text). Group/inquiry chats support structured media messages via `message_type`/`metadata` columns on `group_messages` (migration 093). Key components: `ChatImageMessage`, `ImageGalleryViewer`, `MediaUploadProgress`, `ChatFileMessage`, `ChatAttachmentPicker`.
*   **Security & Safety:** Includes robust verification features (Instagram, multi-photo, identity, agent license), background checks, a comprehensive block/report system, chat leakage detection, contact info protection, and a Trust Score system. Enhanced reporting and moderation tools allow for granular report reasons, photo evidence, and automated moderation actions.
*   **Monetization & Management:** Features a Boost System for hosts to improve listing visibility, tiered subscription plans for different user roles, and screens for plan comparison and billing history.
*   **Account Management:** Includes soft-delete functionality and the ability for renters to pause their search profiles.
*   **UI/UX:** Employs a consistent dark theme, collapsible/sticky headers, platform-specific interactions, and a comprehensive location system with Area Info Cards. Supports Renter/Host mode switching and an Affiliate Program.
*   **Preferences & Amenities:** Allows hosts to set gender preferences for listings and renters to specify household gender preferences for enhanced matching. Features a centralized amenity system and a Host Badge System for achievements.

## Backend

Supabase provides the complete backend infrastructure:
*   **Auth:** Email/password authentication with Row Level Security (RLS).
*   **Database:** PostgreSQL with RLS, computed columns, and preference tables.
*   **Realtime:** Subscriptions for messaging, notifications, typing indicators, and online presence tracking via Supabase Realtime Presence.
*   **Push Notifications:** Expo Notifications handled by a service and Edge Functions.
*   **Storage:** For media assets.
*   **Edge Functions:** Used for webhooks, verification, payments, AI operations, and match calculations.
*   **Neighborhood Knowledge Base:** A PostgreSQL table with pre-seeded data for NYC/NJ neighborhoods, queried by Pi AI.

## Technical Decisions

The architecture includes a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), robust error handling, separate stack navigators with history, and efficient data fetching to prevent N+1 issues.

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