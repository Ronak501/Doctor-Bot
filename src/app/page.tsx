'use client';

import { useState, useEffect, useRef } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function Home() {
  const [activeTab, setActiveTab] = useState<'patient' | 'doctor' | 'accountant'>('patient');
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am Doctor-Bot. Could you please tell me your full name to get started?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dashboard States
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Sarvam STT State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hasSpokenWelcomeRef = useRef(false);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial welcome voice
  useEffect(() => {
    if (activeTab === 'patient' && messages.length === 1 && !hasSpokenWelcomeRef.current) {
      hasSpokenWelcomeRef.current = true;
      playTTS(messages[0].content);
    }
  }, [activeTab, messages.length]);

  const playTTS = async (text: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        const audio = new Audio("data:audio/wav;base64," + data.audioBase64);
        audio.play();
      }
    } catch (err) {
      console.error('TTS Error:', err);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputText('');
    setIsChatting(true);

    try {
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      
      if (data.success && data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        playTTS(data.reply);
      }
    } catch (err) {
      console.error('Groq Error:', err);
    } finally {
      setIsChatting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const sttFormData = new FormData();
        sttFormData.append('file', audioBlob, 'audio.wav');
        
        try {
          const res = await fetch('/api/stt', { method: 'POST', body: sttFormData });
          const data = await res.json();
          if (data.success && data.text) {
            handleSendMessage(data.text);
          }
        } catch (error) {
          console.error('STT Error:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitMessage('Analyzing conversation and extracting details...');
    
    // Create text transcript of the whole chat
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    try {
      // 1. Get structured data from the transcript using LLaMA
      const summaryRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const summaryData = await summaryRes.json();
      
      if (!summaryData.success || !summaryData.data) throw new Error('Failed to summarize');

      // 2. Submit to database
      const dbRes = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...summaryData.data,
          age: parseInt(summaryData.data.age) || 0,
          symptoms: summaryData.data.symptoms + `\n\n[Full Chat Transcript Available]`
        })
      });

      const dbData = await dbRes.json();
      if (dbData.success) {
        setSubmitMessage('Successfully sent to the clinic! The doctor will see you shortly.');
      } else {
        setSubmitMessage('Failed to save to database.');
      }
    } catch (err) {
      setSubmitMessage('Error submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dashboard Functions
  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inquiries');
      const data = await res.json();
      if (data.success) setInquiries(data.data);
    } catch (error) {
      console.error('Failed to fetch inquiries', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/inquiries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paymentStatus: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setInquiries(prev => prev.map(inq => inq._id === id ? { ...inq, paymentStatus: newStatus } : inq));
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (activeTab === 'doctor' || activeTab === 'accountant') {
      fetchInquiries();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-blue-600 mb-3 tracking-tight">
            Doctor-Bot Clinic
          </h1>
          <p className="text-lg text-slate-500">
            Interactive AI Voice Portal
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('patient')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all duration-200 ${
              activeTab === 'patient' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Patient Chat
          </button>
          <button 
            onClick={() => setActiveTab('doctor')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all duration-200 ${
              activeTab === 'doctor' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Doctor Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('accountant')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all duration-200 ${
              activeTab === 'accountant' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Accountant Dashboard
          </button>
        </div>

        {activeTab === 'patient' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/50 flex flex-col h-[600px] border border-slate-100 overflow-hidden">
            
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  }`}>
                    {msg.role === 'assistant' && <div className="text-xs font-bold text-blue-500 mb-1 flex items-center gap-1">🤖 Doctor-Bot</div>}
                    <p className="leading-relaxed">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button onClick={() => playTTS(msg.content)} className="mt-2 text-xs opacity-70 hover:opacity-100 transition-opacity">
                        🔊 Play audio
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-bl-none p-4 shadow-sm">
                    <span className="animate-pulse">Typing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Submit Banner */}
            {submitMessage && (
              <div className={`p-4 text-center font-medium ${submitMessage.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {submitMessage}
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                  placeholder="Type your answer here..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={isRecording || isSubmitting}
                />
                <button 
                  onClick={() => handleSendMessage(inputText)}
                  disabled={!inputText.trim() || isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold transition-colors shadow-md"
                >
                  Send
                </button>
                <button 
                  onClick={toggleRecording}
                  disabled={isSubmitting}
                  className={`p-3 rounded-xl shadow-md transition-all ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-white border border-slate-300 hover:bg-slate-50 text-blue-600'
                  }`}
                  title={isRecording ? "Stop recording" : "Speak instead"}
                >
                  {isRecording ? '⏹' : '🎤'}
                </button>
              </div>
              
              <button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting || messages.length < 3}
                className="w-full mt-2 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                I'm done - Submit to Doctor
              </button>
            </div>
          </div>
        )}

        {/* Doctor Dashboard */}
        {activeTab === 'doctor' && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Medical Inquiries</h2>
              <button onClick={fetchInquiries} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg">
                Refresh List
              </button>
            </div>

            {isLoading ? <p className="text-center py-10">Loading...</p> : inquiries.length === 0 ? (
              <p className="text-center py-10 text-slate-500">No inquiries found.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {inquiries.map((inquiry) => (
                  <div key={inquiry._id} className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full ${inquiry.paymentStatus === 'Paid' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <div className="flex justify-between items-start mb-4 ml-2">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{inquiry.patientName}</h3>
                        <p className="text-sm text-slate-500 font-medium">{inquiry.age} years old • {new Date(inquiry.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${inquiry.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inquiry.paymentStatus}
                      </span>
                    </div>
                    <div className="space-y-4 ml-2 mt-4">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Main Problem</span>
                        <p className="text-slate-800 font-semibold text-lg">{inquiry.mainProblem}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm whitespace-pre-line">
                        <span className="text-xs font-bold text-blue-500 uppercase mb-2 block">Symptoms / AI Q&A</span>
                        <p className="text-slate-700 text-sm leading-relaxed">{inquiry.symptoms}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</span>
                        <p className="text-slate-700 font-medium">{inquiry.duration}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accountant Dashboard */}
        {activeTab === 'accountant' && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-emerald-800">Billing & Accounts</h2>
              <button onClick={fetchInquiries} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg">
                Refresh List
              </button>
            </div>

            {isLoading ? <p className="text-center py-10">Loading...</p> : inquiries.length === 0 ? (
              <p className="text-center py-10 text-slate-500">No billing records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="p-4 font-semibold text-slate-600">Date</th>
                      <th className="p-4 font-semibold text-slate-600">Patient Name</th>
                      <th className="p-4 font-semibold text-slate-600">Fee (₹)</th>
                      <th className="p-4 font-semibold text-slate-600">Status</th>
                      <th className="p-4 font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.map((inquiry) => (
                      <tr key={inquiry._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm text-slate-500">{new Date(inquiry.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 font-medium text-slate-800">{inquiry.patientName}</td>
                        <td className="p-4 font-bold text-emerald-600">₹{inquiry.fee}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${inquiry.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {inquiry.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          {inquiry.paymentStatus === 'Pending' ? (
                            <button onClick={() => updatePaymentStatus(inquiry._id, 'Paid')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 px-3 rounded">
                              Mark as Paid
                            </button>
                          ) : (
                            <button onClick={() => updatePaymentStatus(inquiry._id, 'Pending')} className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold py-1.5 px-3 rounded">
                              Revert
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
