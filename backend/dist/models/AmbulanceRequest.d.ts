import mongoose, { Document } from 'mongoose';
export interface IAmbulanceRequest extends Document {
    user: mongoose.Types.ObjectId;
    patientName: string;
    patientPhone?: string;
    pickupLocation: {
        address: string;
        latitude: number;
        longitude: number;
    };
    destination?: {
        address: string;
        latitude?: number;
        longitude?: number;
    };
    status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
    ambulance?: mongoose.Types.ObjectId;
    emergencyDetails?: string;
}
declare const AmbulanceRequest: mongoose.Model<IAmbulanceRequest, {}, {}, {}, mongoose.Document<unknown, {}, IAmbulanceRequest, {}, {}> & IAmbulanceRequest & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default AmbulanceRequest;
//# sourceMappingURL=AmbulanceRequest.d.ts.map