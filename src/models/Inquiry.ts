import mongoose from 'mongoose';

const InquirySchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: [true, 'Please provide the patient name'],
    },
    age: {
      type: Number,
      required: [true, 'Please provide the age'],
    },
    mainProblem: {
      type: String,
      required: [true, 'Please provide the main problem'],
    },
    symptoms: {
      type: String,
      required: [true, 'Please describe the symptoms'],
    },
    duration: {
      type: String,
      required: [true, 'Please provide how long you have had this problem'],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Inquiry || mongoose.model('Inquiry', InquirySchema);
