  const getSponsorClassName = (sponsorId: number) => {
    if(process.env.REACT_APP_CFA_SPONSOR_ID && process.env.REACT_APP_CFA_SPONSOR_ID === `${sponsorId}`){
      return "CFA"
    }
    return "NONE"
  }

  export default getSponsorClassName