"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBloodRequestStatus = exports.getUserBloodRequests = exports.getBloodRequestById = exports.requestBlood = exports.getBloodInventory = exports.recordBloodDonation = exports.getDonors = exports.registerAsDonor = void 0;
const BloodDonation_1 = __importDefault(require("../models/BloodDonation"));
const BloodRequest_1 = __importDefault(require("../models/BloodRequest"));
const User_1 = __importDefault(require("../models/User"));
/**
 * Register as a blood donor
 * @route PUT /api/blood-donation/register-donor
 * @access Private
 */
const registerAsDonor = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const user = await User_1.default.findById(req.user._id);
        if (user) {
            user.isDonor = true;
            user.bloodGroup = req.body.bloodGroup || user.bloodGroup;
            user.lastDonationDate = req.body.lastDonationDate || user.lastDonationDate;
            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                bloodGroup: updatedUser.bloodGroup,
                isDonor: updatedUser.isDonor,
                lastDonationDate: updatedUser.lastDonationDate,
            });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.registerAsDonor = registerAsDonor;
/**
 * Get all blood donors
 * @route GET /api/blood-donation/donors
 * @access Private
 */
const getDonors = async (req, res) => {
    try {
        const { bloodGroup } = req.query;
        const filter = { isDonor: true };
        if (bloodGroup) {
            filter.bloodGroup = bloodGroup;
        }
        const donors = await User_1.default.find(filter).select('-password');
        res.json(donors);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.getDonors = getDonors;
/**
 * Record a blood donation
 * @route POST /api/blood-donation
 * @access Private
 */
const recordBloodDonation = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const { bloodGroup, quantity, donationDate, hospital } = req.body;
        // Create blood donation record
        const bloodDonation = await BloodDonation_1.default.create({
            donor: req.user._id,
            bloodGroup,
            quantity,
            donationDate: donationDate || new Date(),
            hospital,
        });
        // Update user's last donation date
        await User_1.default.findByIdAndUpdate(req.user._id, {
            lastDonationDate: donationDate || new Date(),
        });
        res.status(201).json(bloodDonation);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.recordBloodDonation = recordBloodDonation;
/**
 * Get blood inventory
 * @route GET /api/blood-donation/inventory
 * @access Private
 */
const getBloodInventory = async (req, res) => {
    try {
        const inventory = await BloodDonation_1.default.aggregate([
            { $match: { status: 'available' } },
            {
                $group: {
                    _id: '$bloodGroup',
                    totalUnits: { $sum: '$quantity' },
                    donations: { $push: '$$ROOT' },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        res.json(inventory);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.getBloodInventory = getBloodInventory;
/**
 * Request blood
 * @route POST /api/blood-donation/request
 * @access Private
 */
const requestBlood = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const { patientName, patientAge, bloodGroup, quantity, hospital, urgency, requiredBy, medicalNotes, } = req.body;
        // Create blood request
        const bloodRequest = await BloodRequest_1.default.create({
            requester: req.user._id,
            patientName,
            patientAge,
            bloodGroup,
            quantity,
            hospital,
            urgency: urgency || 'normal',
            requiredBy,
            medicalNotes,
        });
        // Check if there's enough blood in inventory
        const availableBlood = await BloodDonation_1.default.find({
            bloodGroup,
            status: 'available',
        }).sort({ donationDate: 1 }); // Use oldest blood first
        let remainingQuantity = quantity;
        const fulfilledBy = [];
        // Allocate blood if available
        for (const donation of availableBlood) {
            if (remainingQuantity <= 0)
                break;
            if (donation.quantity <= remainingQuantity) {
                // Use entire donation
                remainingQuantity -= donation.quantity;
                donation.status = 'reserved';
                await donation.save();
                fulfilledBy.push(donation._id);
            }
            else {
                // Use partial donation
                donation.quantity -= remainingQuantity;
                await donation.save();
                // Create a new record for the allocated portion
                const allocatedDonation = await BloodDonation_1.default.create({
                    donor: donation.donor,
                    bloodGroup: donation.bloodGroup,
                    quantity: remainingQuantity,
                    donationDate: donation.donationDate,
                    expiryDate: donation.expiryDate,
                    status: 'reserved',
                    hospital: hospital,
                });
                fulfilledBy.push(allocatedDonation._id);
                remainingQuantity = 0;
            }
        }
        // Update request status based on fulfillment
        if (remainingQuantity === 0) {
            bloodRequest.status = 'fulfilled';
            bloodRequest.fulfilledBy = fulfilledBy;
            await bloodRequest.save();
        }
        else if (fulfilledBy.length > 0) {
            bloodRequest.status = 'processing';
            bloodRequest.fulfilledBy = fulfilledBy;
            await bloodRequest.save();
        }
        res.status(201).json(bloodRequest);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.requestBlood = requestBlood;
/**
 * Get blood request by ID
 * @route GET /api/blood-donation/request/:id
 * @access Private
 */
const getBloodRequestById = async (req, res) => {
    try {
        const bloodRequest = await BloodRequest_1.default.findById(req.params.id)
            .populate('requester', 'name email phone')
            .populate('fulfilledBy');
        if (bloodRequest) {
            res.json(bloodRequest);
        }
        else {
            res.status(404).json({ message: 'Blood request not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.getBloodRequestById = getBloodRequestById;
/**
 * Get user's blood requests
 * @route GET /api/blood-donation/request/user
 * @access Private
 */
const getUserBloodRequests = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const bloodRequests = await BloodRequest_1.default.find({ requester: req.user._id })
            .sort({ createdAt: -1 });
        res.json(bloodRequests);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.getUserBloodRequests = getUserBloodRequests;
/**
 * Update blood request status
 * @route PUT /api/blood-donation/request/:id/status
 * @access Private/Admin
 */
const updateBloodRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const bloodRequest = await BloodRequest_1.default.findById(req.params.id);
        if (bloodRequest) {
            bloodRequest.status = status;
            // If request is fulfilled, update the blood donation status to used
            if (status === 'fulfilled' && bloodRequest.fulfilledBy) {
                for (const donationId of bloodRequest.fulfilledBy) {
                    await BloodDonation_1.default.findByIdAndUpdate(donationId, { status: 'used' });
                }
            }
            // If request is cancelled, return the blood to inventory
            if (status === 'cancelled' && bloodRequest.fulfilledBy) {
                for (const donationId of bloodRequest.fulfilledBy) {
                    await BloodDonation_1.default.findByIdAndUpdate(donationId, { status: 'available' });
                }
                bloodRequest.fulfilledBy = [];
            }
            const updatedRequest = await bloodRequest.save();
            res.json(updatedRequest);
        }
        else {
            res.status(404).json({ message: 'Blood request not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
exports.updateBloodRequestStatus = updateBloodRequestStatus;
//# sourceMappingURL=bloodDonationController.js.map