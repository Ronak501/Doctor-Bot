'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'patient' | 'doctor'>('patient');
  
  // Form State
  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    mainProblem: '',
    symptoms: '',
    duration: ''
  });
  
  const [dynamicQuestion, setDynamicQuestion] = useState('');
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Doctor Dashboard State
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Sarvam STT State
  const [isRecording, setIsRecording] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Function to handle Sarvam Text-to-Speech
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

  // Generate dynamic question using Groq
  const generateDynamicQuestion = async () => {
    if (!formData.mainProblem) return;
    setIsGeneratingQuestion(true);
    try {
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientData: formData })
      });
      const data = await res.json();
      if (data.success && data.question) {
        setDynamicQuestion(data.question);
        playTTS(data.question);
      }
    } catch (err) {
      console.error('Groq Error:', err);
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  const startRecording = async (fieldName: string) => {
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
          const res = await fetch('/api/stt', {
            method: 'POST',
            body: sttFormData
          });
          const data = await res.json();
          if (data.success && data.text) {
            setFormData(prev => ({
              ...prev,
              [fieldName]: prev[fieldName as keyof typeof prev] + (prev[fieldName as keyof typeof prev] ? ' ' : '') + data.text
            }));
          }
        } catch (error) {
          console.error('STT Error:', error);
        }
      };

      mediaRecorder.start();
      setActiveField(fieldName);
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setActiveField(null);
    }
  };

  const toggleRecording = (fieldName: string) => {
    if (isRecording && activeField === fieldName) {
      stopRecording();
    } else {
      if (isRecording) stopRecording();
      startRecording(fieldName);
    }
  };

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inquiries');
      const data = await res.json();
      if (data.success) {
        setInquiries(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'doctor') {
      fetchInquiries();
    }
  }, [activeTab]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age, 10),
          symptoms: `${dynamicQuestion ? `Q: ${dynamicQuestion}\nA: ` : ''}${formData.symptoms}`
        })
      });

      const data = await res.json();
      if (data.success) {
        setSubmitMessage('Inquiry submitted successfully! The doctor will review it before your meeting.');
        setFormData({ patientName: '', age: '', mainProblem: '', symptoms: '', duration: '' });
        setDynamicQuestion('');
      } else {
        setSubmitMessage('Failed to submit inquiry. Please try again.');
      }
    } catch (error) {
      setSubmitMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-blue-600 mb-3 tracking-tight">
            Doctor-Bot
          </h1>
          <p className="text-lg text-slate-500">
            Smart pre-consultation system powered by AI
          </p>
        </div>

        <div className="flex justify-center space-x-4 mb-8">
          <button 
            onClick={() => setActiveTab('patient')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all duration-200 ${
              activeTab === 'patient' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Patient Portal
          </button>
          <button 
            onClick={() => setActiveTab('doctor')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all duration-200 ${
              activeTab === 'doctor' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Doctor Dashboard
          </button>
        </div>

        {activeTab === 'patient' && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Let's understand your problem</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  What is your main problem or reason for visit?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="mainProblem"
                    value={formData.mainProblem}
                    onChange={handleInputChange}
                    onBlur={generateDynamicQuestion}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Severe headache"
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleRecording('mainProblem')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full ${
                      isRecording && activeField === 'mainProblem' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-500'
                    }`}
                  >
                    🎤
                  </button>
                </div>
              </div>

              {isGeneratingQuestion && (
                <p className="text-blue-500 font-medium text-sm animate-pulse">Doctor-Bot is thinking of a follow-up question...</p>
              )}

              {dynamicQuestion && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">🤖</span>
                    <div>
                      <p className="text-blue-900 font-semibold mb-2">{dynamicQuestion}</p>
                      <button 
                        type="button" 
                        onClick={() => playTTS(dynamicQuestion)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline uppercase tracking-wider"
                      >
                        🔊 Listen again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {dynamicQuestion ? 'Your Answer & Other Symptoms' : 'Please describe your symptoms in detail'}
                </label>
                <div className="relative">
                  <textarea
                    name="symptoms"
                    value={formData.symptoms}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                  <button 
                    type="button" 
                    onClick={() => toggleRecording('symptoms')}
                    className={`absolute right-3 top-4 p-2 rounded-full ${
                      isRecording && activeField === 'symptoms' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-500'
                    }`}
                  >
                    🎤
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  How long have you been experiencing this?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleRecording('duration')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full ${
                      isRecording && activeField === 'duration' ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-blue-500'
                    }`}
                  >
                    🎤
                  </button>
                </div>
              </div>

              {isRecording && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center text-sm font-medium">
                  <span className="relative flex h-3 w-3 mr-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Recording... speak now. Click the mic again to stop and transcribe via Sarvam AI.
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors shadow-md disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Inquiry to Doctor'}
              </button>
              
              {submitMessage && (
                <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                  {submitMessage}
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'doctor' && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Patient Inquiries</h2>
              <button 
                onClick={fetchInquiries} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg"
              >
                Refresh List
              </button>
            </div>

            {isLoading ? (
              <p className="text-center py-10">Loading...</p>
            ) : inquiries.length === 0 ? (
              <p className="text-center py-10 text-slate-500">No inquiries found.</p>
            ) : (
              <div className="space-y-4">
                {inquiries.map((inquiry) => (
                  <div key={inquiry._id} className="p-6 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{inquiry.patientName}, {inquiry.age} yrs</h3>
                      </div>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                        {new Date(inquiry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Main Problem</span>
                        <p className="text-slate-800 font-medium">{inquiry.mainProblem}</p>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg border border-slate-100 whitespace-pre-line">
                        <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Symptoms / Q&A</span>
                        <p className="text-slate-700 text-sm">{inquiry.symptoms}</p>
                      </div>
                      
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Duration</span>
                        <p className="text-slate-700">{inquiry.duration}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
