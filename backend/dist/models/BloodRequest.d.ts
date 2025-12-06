import mongoose, { Document } from 'mongoose';
export interface IBloodRequest extends Document {
    requester: mongoose.Types.ObjectId;
    patientName: string;
    patientAge?: number;
    bloodGroup: string;
    quantity: number;
    hospital: string;
    urgency: 'normal' | 'urgent' | 'critical';
    status: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
    requiredBy?: Date;
    medicalNotes?: string;
    fulfilledBy?: mongoose.Types.ObjectId[];
}
declare const BloodRequest: mongoose.Model<IBloodRequest, {}, {}, {}, mongoose.Document<unknown, {}, IBloodRequest, {}, {}> & IBloodRequest & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default BloodRequest;
//# sourceMappingURL=BloodRequest.d.ts.map