import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export const metadata = { title: 'Privacy and learning', alternates: { canonical: '/privacy' } };
export default function Page() {
  return <main id="main-content" className="site-width policy-page"><Link className="breadcrumb" href="/"><ArrowLeft size={16} /> Back to Cellula</Link>
    <p className="kicker">Study on your terms</p><h1>Privacy & learning</h1>
    <div className="prose">
      <h2>Your field bag</h2><p>Without an account, bookmarks and study progress stay in this browser. Clearing site data removes them. When you sign in, the account stores its own study progress so you can use it on more than one device. You choose whether to copy guest progress to an account.</p>
      <h2>Using Guru Jee</h2><p>A guest cookie counts your two study messages. When live AI is enabled, the text of your question and a short conversation history go to the model provider. Cellula doesn’t save your conversation as a chat history. Don’t add names, contact details, or other personal information to a question. AI answers can be wrong; check them against your notes or a trusted reference.</p>
      <h2>Camera and voice are optional</h2><p>The camera is off by default. If you enable it, only this browser checks whether a face is present. Cellula doesn’t identify you, estimate your emotions, or upload images. Closing Guru Jee or leaving the tab turns the camera off. Voice typing, where available, may use your browser’s speech service. Review the transcription before sending it.</p>
      <h2>Video lessons</h2><p>Video cards may show a thumbnail delivered by YouTube. The embedded YouTube player only loads when you choose to play a video. YouTube’s own policies apply to the player.</p>
    </div>
  </main>;
}
