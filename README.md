# 🏡 CommunitEase

**CommunitEase** is a modern, minimalist platform built to bridge the gap between citizens and local authorities. It empowers users to report civic issues—like potholes, broken streetlights, or litter—instantly, while using AI to digitize legacy field records.

![CommunitEase Hero](https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1200)

## ✨ Key Features

- **📍 Geospatial Issue Tracking**: Report incidents with real-time location and visual evidence.
- **🤖 AI Field Report Digitizer**: Upload photos of handwritten or printed field surveys and let **Gemini AI** extract structured data automatically.
- **🤝 Community Voting**: Upvote critical issues to help authorities prioritize effectively.
- **🏆 Reputation System**: Earn levels and trust within your community by being an active reporter.
- **⚡ Real-time Feedback**: Live updates provided by Firebase Firestore for a seamless collaborative experience.
- **📱 Responsive & Fluid**: Built with React and Framer Motion for a "premium app" feel on any device.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js (Express)
- **AI**: Google Gemini 1.5 Flash (via `@google/genai`)
- **Database/Auth**: Firebase (Firestore & Auth)
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- A Firebase Project (Firestore enabled)
- A Google AI Studio (Gemini) API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/communit-ease.git
   cd communit-ease
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root and add your keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
   Also, ensure your `firebase-applet-config.json` is correctly set up with your Firebase credentials.

4. **Run in Development**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## ☁️ Deployment

This project is optimized for deployment on **Vercel**:

- The frontend is served as a static site.
- The serverless backend handles the AI processing securely.
- Important: Add `GEMINI_API_KEY` to your Vercel Environment Variables.

## 🤝 Contributing

Contributions make the community better! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for a better tomorrow.*
