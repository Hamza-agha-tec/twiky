export const mentionSuggestionItems = ({ query }) => {
    // In a real app, this would fetch from an API
    const users = [
        "John Doe",
        "Jane Smith",
        "Alice Johnson",
        "Bob Brown",
        "Charlie Davis",
    ];

    return users
        .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
        .map(user => ({
            label: user,
            title: user,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setMention({ id: user, label: user }).run();
            }
        }));
};
