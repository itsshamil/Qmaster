# Queue Buddy - SMART Queue Management System

Queue Buddy is a modern, AI-powered queue management application designed to provide a seamless experience for both customers and staff. It features real-time updates, geofenced ticket generation, and intelligent wait-time predictions.

## 🚀 Key Features

### For Customers
- **Glassmorphic UI**: A premium, modern interface with rich aesthetics, smooth transitions, and responsive design.
- **Geofenced Booking**: Ensures users are within a physical radius of the service before they can take a ticket.
- **AI Wait Predictions**: Intelligent, dynamic wait time calculations that update in real-time as service speeds change.
- **Real-time Tracking**: Live queue position updates and status alerts (Waiting, Serving, Completed).
- **QR Code Integration**: Scan to track status and verifiable tickets.
- **Profile Customization**: Auto-generated masked names and easy profile management.

### For Staff
- **Unified Dashboard**: Manage multiple services from a single "Command Center" interface.
- **Session Management**: Track service sessions with precise timestamps.
- **Dynamic Controls**: Pause/Resume queues, call next tokens, and set daily capacity limits.
- **Data Export**: Generate PDF and CSV reports for daily or historical token data.
- **Scanner Support**: Integrated QR scanning for verifying customer tickets.

---

## 🛠 Technology Stack

### Frontend
- **React (Vite)**: Fast, modern UI development.
- **TypeScript**: Strict typing for reliability and maintainability.
- **Tailwind CSS**: Utility-first styling with custom glassmorphism effects.
- **Lucide React**: Clean, modern iconography.
- **TanStack Query**: Robust state management and data caching.
- **Sonner**: High-quality toast notifications.

### Backend (Built on Supabase)
- **PostgreSQL**: Reliable relational database.
- **Supabase Auth**: Secure user authentication and authorization.
- **Supabase Realtime**: Instant synchronization across all connected clients.
- **Postgres Functions (RPC)**: Server-side logic for complex metrics and token generation.
- **RLS (Row Level Security)**: Secure, policy-based data access control.

---

## 🏗 Database Architecture

### Core Tables
- `tokens`: Tracks every queue entry, its status, service ID, and customer ID.
- `services`: Stores service details, location (Lat/Long), daily limits, and pause status.
- `profiles`: User information with automatic masked name generation triggers.
- `staff`: Links users to specific service management roles.
- `sessions`: Records staff service sessions and performance metrics.

### Security (RLS Policies)
- The system uses a strict "Own Data Only" policy for customers.
- Staff have elevated permissions to manage tokens and sessions for their assigned services.
- Profiles are protected such that only the owner can update their personal information.

---

## 🧠 Synchronization & AI Logic

### AI Wait Time Prediction
Wait times are calculated dynamically using the `get_service_metrics` PostgreSQL function. 
- **Algorithm**: `Prediction = (Position × (Total_AI_Time / Total_Waiters))`
- **Default**: 5 minutes per person when historical data is absent.
- **Synchronization**: All components (Dashboard, Queue List, Stats) use a unified calculation to ensure consistency.

### Real-time Engine
The application uses Supabase Realtime to listen for changes on the `tokens` table. Any token creation, status update (e.g., calling a user), or deletion is reflected instantly on the customer's dashboard without page refreshes.

---

## 📈 Recent Major Updates

1. **Unified Wait Times**: Synchronized individual token wait times with the master AI prediction.
2. **QR Visibility Fix**: QR codes now remain visible during the "Serving" phase for easier verification.
3. **Glassmorphism Re-design**: Entire customer-facing app updated with high-end blurred backgrounds and glowing gradients.
4. **Enhanced RLS**: Resolved conflicting profile update policies to enable reliable user name changes.
5. **Auto-Masked Names**: SQL Trigger automatically formats "John Doe" into "J. Doe" for privacy in public displays.

---

## 📖 Getting Started

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   npm install
   ```
2. **Environment Setup**: Create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Run Locally**:
   ```bash
   npm run dev
   ```

---

**Project Status**: Production Ready ✅
**Documentation Version**: 2.0
**Last Updated**: February 8, 2026
