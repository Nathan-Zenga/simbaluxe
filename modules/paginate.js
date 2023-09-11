module.exports = (arr, chunk_size) => arr.reduce((acc, val, i) => {
    const idx = Math.floor(i / chunk_size);
    const page = acc[idx] || (acc[idx] = []);
    page.push(val);
    return acc;
}, [])
