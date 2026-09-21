# Taskr Mobile (React Native Expo)

Production-ready mobile application for **Taskr** (Employee Task Management & Work Reporting), built with **React Native** and **Expo SDK 52**.

Shares 100% of the backend REST API with the web application (`frontend/`).

---

## 🚀 Quick Start

### 1. Start the Shared Backend & Web App
From the root directory:
```bash
npm run dev
```
*(Backend runs on `http://localhost:4000`, Web app runs on `http://localhost:5173`)*

### 2. Start the Mobile App
From the root directory or inside `mobile/`:
```bash
npm run dev:mobile
# or inside mobile/
npm start
```

---

## 📱 Running on Devices

### A. iOS Simulator (Mac)
```bash
npm run mobile:ios
```

### B. Android Emulator
```bash
npm run mobile:android
```
*Note: Android emulators automatically connect to `http://10.0.2.2:4000/api`.*

### C. Physical Phone (iOS / Android) via Expo Go
1. Install **Expo Go** from App Store or Google Play Store.
2. Start the development server with `npm run dev:mobile`.
3. Scan the QR code using your phone camera (iOS) or Expo Go app (Android).
4. **Connecting to Local Backend:**
   - Tap the **API: Default** button at the bottom of the Login screen (or in Settings).
   - Enter your computer's local Wi-Fi IP address (e.g. `http://192.168.1.15:4000/api`).
   - Sign in seamlessly!

### D. Web Browser Preview
```bash
npm run mobile:web
```

### E. If Expo switches ports

The backend allows Expo web ports `8081` and `8082` in development. If Metro reports that `8081` is busy, open the printed `http://localhost:8082` URL and restart `npm run dev` once if the backend was already running before this change.

On a physical phone, the mobile app derives the API host from the Expo QR-code host. Both devices must be on the same Wi-Fi network. You can also use the **API** button on the login screen to enter the computer's LAN address, for example `http://192.168.1.15:4000/api`.

## EAS Development Build

The project includes a native development profile in `eas.json`. The development build is needed for native Expo Notifications and uses `com.taskr.mobile` as its Android and iOS application identifier.

From `mobile/`, run:

```bash
npx eas login
npx eas init
npm run build:development
```

Install the generated Android APK on a device, or use the iOS simulator build on macOS. Start the development server with `npm run dev:client` and open it in the installed development build.

---

## ✨ Full Feature Parity

### 👨‍💼 Manager & Admin Portal
- **Dashboard Overview**: Key KPIs (Open/Critical Tickets, Assigned/Completed Today, Overdue, Submission rates, Status breakdown distribution).
- **Team Management**: Real-time team roster, daily report submission status indicators, Add/Invite team member modal, elevated staff management (for Admins).
- **Employee Detail View**: Individual employee stats, assigned task list, historical daily reports feed.
- **Task Delegation & Assignment**: Assign tasks to employees with project linking, priorities, deadlines, and notes. Update status, edit, or delete tasks.
- **Team Daily Reports Feed**: Filter reports by time window (Today, Week, Month, All Time) or search by author.
- **Ticket / Issue Management**: Review reported blockers, set statuses (In Progress, Resolved, Closed), enter resolution notes.
- **Analytics & Productivity**: Completion rates %, task volume per team member, delivery metrics.

### 👩‍💻 Team Member (Employee) Portal
- **Employee Dashboard**: Headline task counts, daily report reminder banner, active assigned tasks list, recent tickets.
- **Assigned Tasks**: Filter by status (Pending, In Progress, Overdue), search by title/project, inspect full task notes & manager details, update task progress.
- **Tasks Delivered**: Archive and search history of completed tasks.
- **My Day**:
  - **Daily Work Report**: Write and update today's daily work report.
  - **Personal Checklist**: Add, toggle, and manage private daily todos with optional project/task tagging.
- **Tickets / Issue Reporting**: Raise blockers with severity levels (Low, Medium, High, Critical) and link directly to projects and tasks.

### 🔒 Common Features
- **Role-based Authentication**: Automatic routing to Manager or Employee portal based on verified JWT session.
- **Invitation Activation**: Claim new account invitations with password activation.
- **Password Reset**: Forgot password self-service.
- **Profile Management**: Update profile details, change password, customize API endpoint.
- **In-App Notifications**: Real-time polling for task assignments, ticket status updates, and report submissions with badge counters.
