(function() {
    window.createProfileAvatarUI = function createProfileAvatarUI(deps) {
        const { h } = deps || {};
        const profileUtils = window.ProfileUtils || {};
        const { getAvatar, handleAvatarError } = profileUtils;

        if (!h || !getAvatar || !handleAvatarError) {
            throw new Error('Profile avatar UI dependencies are missing');
        }

        const renderAvatarImage = ({ student, studentProfiles, mood = 'happy', className = '' }) => (
            h("img", {
                src: getAvatar(student, studentProfiles, mood),
                className,
                onError: (e) => handleAvatarError(e, student.name, mood)
            })
        );

        return {
            renderAvatarImage
        };
    };
})();
