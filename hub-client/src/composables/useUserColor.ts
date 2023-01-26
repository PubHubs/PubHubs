/**
 *
 * Colors for the users/avatars in a room.
 * TODO: for now just random, in the future a user should have onw color
 *
 */

const textColors = ['text-avatar-green','text-avatar-purple','text-avatar-yellow','text-avatar-red','text-avatar-lime','text-avatar-blue','text-avatar-orange'];
const bgColors = ['bg-avatar-green','bg-avatar-purple','bg-avatar-yellow','bg-avatar-red','bg-avatar-lime','bg-avatar-blue','bg-avatar-orange'];

const useUserColor = () => {

    const color = () : number => {
        return Math.floor(Math.random() * textColors.length);
    }

    const textColor = (number:number) : string => {
        return textColors[number];
    }

    function bgColor(number: number): string {
        return bgColors[number];
    }


    return { color, textColor, bgColor }
}

export { useUserColor };

