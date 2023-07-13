/**
 *  Get user Information e.g., user's display name.
 *
 */

import { Room } from "@/store/rooms";

const useUserName = () => {

    /**
     * Get unique color index depending on userId
     */
   
    function getUserDisplayName(user: string, currentRoom: Room) { 
        const member = currentRoom.getMember(user);
    
        if (member != null) {
            if (member.user != undefined && member.user.displayName != undefined) {
                return member.user.displayName;
            }
        }
        return user;
    }

    return { getUserDisplayName}
}

export { useUserName };

