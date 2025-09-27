import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserData } from '../types';

const USER_DATA_COLLECTION = 'users';

export const getUserData = async (uid: string): Promise<UserData | null> => {
    try {
        const userDocRef = doc(db, USER_DATA_COLLECTION, uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserData;
        } else {
            console.log(`No data found for user ${uid}`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        return null;
    }
};

export const saveUserData = async (uid: string, data: UserData): Promise<void> => {
    try {
        const userDocRef = doc(db, USER_DATA_COLLECTION, uid);
        await setDoc(userDocRef, data, { merge: true }); // Use merge to avoid overwriting complete doc on partial saves
    } catch (error) {
        console.error("Error saving user data to Firestore:", error);
    }
};

export const removeUserData = async (uid: string): Promise<void> => {
    try {
        const userDocRef = doc(db, USER_DATA_COLLECTION, uid);
        await deleteDoc(userDocRef);
    } catch (error) {
        console.error("Error deleting user data from Firestore:", error);
    }
}
